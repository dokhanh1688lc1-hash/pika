import { currentStoreId } from "@/lib/auth";
import { env, isSupabaseConfigured } from "@/lib/env";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  demoAppointments, demoBatches, demoCustomers, demoProducts, demoStaff, demoStats,
} from "./demo";
import type {
  Appointment, BatchRow, Customer, DashboardStats, OrderRow, Product, StaffMember,
} from "./types";

/**
 * Lớp truy cập dữ liệu duy nhất cho UI, Telegram Bot và AI Agent.
 * - Chưa cấu hình Supabase -> trả dữ liệu demo.
 * - Đã cấu hình            -> đọc từ DB, LUÔN lọc theo store_id.
 *   `storeId` truyền vào rõ ràng (Telegram/AI) hoặc lấy từ phiên đăng nhập (web).
 */

async function resolveStore(storeId?: string): Promise<string> {
  return storeId ?? (await currentStoreId());
}

export async function listProducts(storeId?: string): Promise<Product[]> {
  if (!isSupabaseConfigured()) return demoProducts;
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  const { data, error } = await getAdminClient()
    .from("v_products")
    .select("id, sku, name, kind, category, price, cost, stock, min_stock")
    .eq("store_id", sid)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, sku: r.sku, name: r.name, kind: r.kind, category: r.category,
    price: Number(r.price), cost: Number(r.cost),
    stock: r.stock === null ? null : Number(r.stock), minStock: r.min_stock,
  })) as Product[];
}

export async function searchProducts(query: string, storeId?: string) {
  const q = query.trim().toLowerCase();
  const all = await listProducts(storeId);
  return all.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
}

export async function lowStockProducts(storeId?: string) {
  const all = await listProducts(storeId);
  return all.filter((p) => p.stock !== null && p.stock <= p.minStock);
}

export async function listCustomers(storeId?: string): Promise<Customer[]> {
  if (!isSupabaseConfigured()) return demoCustomers;
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  const { data, error } = await getAdminClient()
    .from("customers")
    .select("id, name, phone, tier, points, total_spent, last_visit_at")
    .eq("store_id", sid)
    .order("total_spent", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, name: r.name, phone: r.phone ?? "", tier: r.tier, points: r.points,
    totalSpent: Number(r.total_spent), lastVisit: r.last_visit_at ?? "",
  })) as Customer[];
}

export async function findCustomer(query: string, storeId?: string) {
  const q = query.trim().toLowerCase();
  const all = await listCustomers(storeId);
  return all.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
}

export async function listTodayAppointments(storeId?: string): Promise<Appointment[]> {
  if (!isSupabaseConfigured()) return demoAppointments;
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const { data, error } = await getAdminClient()
    .from("v_appointments")
    .select("id, starts_at, customer, service, staff, status")
    .eq("store_id", sid)
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .order("starts_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    time: new Date(r.starts_at).toLocaleTimeString("vi-VN", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
    }),
    customer: r.customer, service: r.service, staff: r.staff, status: r.status,
  })) as Appointment[];
}

export async function listStaff(storeId?: string): Promise<StaffMember[]> {
  if (!isSupabaseConfigured()) return demoStaff;
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  const { data, error } = await getAdminClient()
    .from("v_staff_performance")
    .select("id, name, role, commission_rate, month_revenue")
    .eq("store_id", sid);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, name: r.name, role: r.role,
    commissionRate: Number(r.commission_rate), monthRevenue: Number(r.month_revenue),
  }));
}

const vnDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d); // YYYY-MM-DD

export async function dashboardStats(storeId?: string): Promise<DashboardStats> {
  if (!isSupabaseConfigured()) return demoStats;
  const sid = await resolveStore(storeId);
  const empty: DashboardStats = {
    todayRevenue: 0, todayOrders: 0, newCustomers: 0, lowStockCount: 0, last7Days: [],
  };
  if (!sid) return empty;

  const db = getAdminClient();
  const since = new Date(); since.setDate(since.getDate() - 6);
  const todayKey = vnDate(new Date());
  const { data, error } = await db
    .from("v_daily_revenue")
    .select("day, revenue, orders")
    .eq("store_id", sid)
    .gte("day", vnDate(since))
    .order("day");
  if (error) throw error;

  // Đủ 7 ngày liên tiếp, ngày không có đơn = 0
  const byDay = new Map((data ?? []).map((r) => [String(r.day), r]));
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const row = byDay.get(vnDate(d));
    return {
      label: new Intl.DateTimeFormat("vi-VN", { weekday: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(d),
      revenue: Number(row?.revenue ?? 0),
    };
  });
  const today = byDay.get(todayKey);
  const low = await lowStockProducts(sid);
  const { count } = await db
    .from("customers").select("id", { count: "exact", head: true })
    .eq("store_id", sid).gte("created_at", `${todayKey}T00:00:00+07:00`);

  return {
    todayRevenue: Number(today?.revenue ?? 0),
    todayOrders: Number(today?.orders ?? 0),
    newCustomers: count ?? 0,
    lowStockCount: low.length,
    last7Days,
  };
}

export async function listOrders(storeId?: string): Promise<OrderRow[]> {
  if (!isSupabaseConfigured()) return [];
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  const { data, error } = await getAdminClient()
    .from("orders")
    .select("id, code, total, status, created_at, customers(name)")
    .eq("store_id", sid)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const c = Array.isArray(r.customers) ? r.customers[0] : r.customers;
    return {
      id: r.id, code: r.code, customer: c?.name ?? "Khách lẻ", total: Number(r.total),
      status: r.status, createdAt: r.created_at,
    };
  }) as OrderRow[];
}

/** Các lô còn hàng, đã hết hạn hoặc sẽ hết hạn trong `withinDays` ngày tới (gần hết hạn nhất trước). */
export async function listExpiring(withinDays: number = env.expiryAlertDays, storeId?: string): Promise<BatchRow[]> {
  if (!isSupabaseConfigured()) return demoBatches.filter((b) => b.daysLeft <= withinDays);
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  const { data, error } = await getAdminClient()
    .from("v_batches")
    .select("id, sku, product, batch_code, quantity, expiry_date, days_left")
    .eq("store_id", sid)
    .lte("days_left", withinDays)
    .order("expiry_date");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, sku: r.sku, product: r.product, batchCode: r.batch_code ?? "",
    quantity: Number(r.quantity), expiryDate: String(r.expiry_date), daysLeft: Number(r.days_left),
  }));
}
