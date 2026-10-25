import { getAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  demoAppointments, demoCustomers, demoProducts, demoStaff, demoStats,
} from "./demo";
import type {
  Appointment, Customer, DashboardStats, Product, StaffMember,
} from "./types";

/**
 * Lớp truy cập dữ liệu duy nhất cho UI, Telegram Bot và AI Agent.
 * - Chưa cấu hình Supabase  -> trả dữ liệu demo (app vẫn chạy được).
 * - Đã cấu hình             -> đọc từ views/bảng trong supabase/migrations.
 * `storeId` luôn được lọc để đảm bảo cách ly dữ liệu giữa các cửa hàng.
 */

const DEFAULT_STORE = process.env.DEFAULT_STORE_ID ?? "";

export async function listProducts(storeId = DEFAULT_STORE): Promise<Product[]> {
  if (!isSupabaseConfigured()) return demoProducts;
  const { data, error } = await getAdminClient()
    .from("v_products")
    .select("id, sku, name, kind, category, price, cost, stock, min_stock")
    .eq("store_id", storeId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, minStock: r.min_stock })) as Product[];
}

export async function searchProducts(query: string, storeId = DEFAULT_STORE) {
  const q = query.trim().toLowerCase();
  const all = await listProducts(storeId);
  return all.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
}

export async function lowStockProducts(storeId = DEFAULT_STORE) {
  const all = await listProducts(storeId);
  return all.filter((p) => p.stock !== null && p.stock <= p.minStock);
}

export async function listCustomers(storeId = DEFAULT_STORE): Promise<Customer[]> {
  if (!isSupabaseConfigured()) return demoCustomers;
  const { data, error } = await getAdminClient()
    .from("customers")
    .select("id, name, phone, tier, points, total_spent, last_visit_at")
    .eq("store_id", storeId)
    .order("total_spent", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, name: r.name, phone: r.phone ?? "", tier: r.tier, points: r.points,
    totalSpent: Number(r.total_spent), lastVisit: r.last_visit_at ?? "",
  })) as Customer[];
}

export async function findCustomer(query: string, storeId = DEFAULT_STORE) {
  const q = query.trim().toLowerCase();
  const all = await listCustomers(storeId);
  return all.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
}

export async function listTodayAppointments(storeId = DEFAULT_STORE): Promise<Appointment[]> {
  if (!isSupabaseConfigured()) return demoAppointments;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const { data, error } = await getAdminClient()
    .from("v_appointments")
    .select("id, starts_at, customer, service, staff, status")
    .eq("store_id", storeId)
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .order("starts_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    time: new Date(r.starts_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    customer: r.customer, service: r.service, staff: r.staff, status: r.status,
  })) as Appointment[];
}

export async function listStaff(storeId = DEFAULT_STORE): Promise<StaffMember[]> {
  if (!isSupabaseConfigured()) return demoStaff;
  const { data, error } = await getAdminClient()
    .from("v_staff_performance")
    .select("id, name, role, commission_rate, month_revenue")
    .eq("store_id", storeId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, name: r.name, role: r.role,
    commissionRate: Number(r.commission_rate), monthRevenue: Number(r.month_revenue),
  }));
}

export async function dashboardStats(storeId = DEFAULT_STORE): Promise<DashboardStats> {
  if (!isSupabaseConfigured()) return demoStats;
  const db = getAdminClient();
  const since = new Date(); since.setDate(since.getDate() - 6); since.setHours(0, 0, 0, 0);
  const { data, error } = await db
    .from("v_daily_revenue")
    .select("day, revenue, orders")
    .eq("store_id", storeId)
    .gte("day", since.toISOString().slice(0, 10))
    .order("day");
  if (error) throw error;
  const rows = data ?? [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = rows.find((r) => r.day === todayKey);
  const low = await lowStockProducts(storeId);
  const { count } = await db
    .from("customers").select("id", { count: "exact", head: true })
    .eq("store_id", storeId).gte("created_at", todayKey);
  return {
    todayRevenue: Number(today?.revenue ?? 0),
    todayOrders: Number(today?.orders ?? 0),
    newCustomers: count ?? 0,
    lowStockCount: low.length,
    last7Days: rows.map((r) => ({
      label: new Date(r.day).toLocaleDateString("vi-VN", { weekday: "short" }),
      revenue: Number(r.revenue),
    })),
  };
}
