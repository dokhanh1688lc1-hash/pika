import { currentStoreId } from "@/lib/auth";
import { env, isSupabaseConfigured } from "@/lib/env";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  demoAppointments, demoBatches, demoCustomers, demoProducts, demoStaff, demoStats,
} from "./demo";
import type {
  Appointment, BatchRow, Branch, Customer, DashboardStats, OrderDetail, OrderRow, Product, ProductDetail,
  PurchaseRow, StaffMember, Supplier, TransferRow,
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
    .select("id, sku, name, kind, category, price, cost, stock, min_stock, image_url")
    .eq("store_id", sid)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, sku: r.sku, name: r.name, kind: r.kind, category: r.category,
    price: Number(r.price), cost: Number(r.cost),
    stock: r.stock === null ? null : Number(r.stock), minStock: r.min_stock,
    imageUrl: r.image_url ?? null,
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

export async function listOrders(storeId?: string, onlyDebt = false): Promise<OrderRow[]> {
  if (!isSupabaseConfigured()) return [];
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  let q = getAdminClient()
    .from("v_orders")
    .select("id, code, customer, total, paid, due, status, created_at")
    .eq("store_id", sid);
  if (onlyDebt) q = q.eq("status", "partial");
  const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, code: r.code, customer: r.customer, total: Number(r.total),
    paid: Number(r.paid), due: Number(r.due), status: r.status, createdAt: r.created_at,
  })) as OrderRow[];
}

/** Tổng công nợ khách hàng (các đơn còn thiếu tiền). */
export async function totalReceivable(storeId?: string): Promise<{ count: number; amount: number }> {
  const rows = await listOrders(storeId, true);
  return { count: rows.length, amount: rows.reduce((a, r) => a + r.due, 0) };
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export async function getOrder(id: string, storeId?: string): Promise<OrderDetail | null> {
  if (!isSupabaseConfigured() || !UUID_RE.test(id)) return null;
  const sid = await resolveStore(storeId);
  if (!sid) return null;
  const db = getAdminClient();
  const { data: o, error } = await db
    .from("orders")
    .select(
      "id, code, status, subtotal, discount, total, note, close_note, created_at, " +
        "customers(name, phone), cashier:staff!orders_cashier_id_fkey(name), branches(name)",
    )
    .eq("store_id", sid).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!o) return null;
  const row = o as unknown as Record<string, any>;

  const [{ data: items }, { data: pays }, { data: store }] = await Promise.all([
    db.from("order_items")
      .select("quantity, unit_price, discount, products(name, sku)")
      .eq("order_id", id).order("id"),
    db.from("payments").select("method, amount, created_at").eq("order_id", id).order("created_at"),
    db.from("stores").select("name, phone, address").eq("id", sid).maybeSingle(),
  ]);
  const payments = (pays ?? []).map((p) => ({ method: p.method as string, amount: Number(p.amount), at: p.created_at as string }));
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const total = Number(row.total);
  const customer = one<{ name: string; phone: string | null }>(row.customers);
  return {
    id: row.id, code: row.code, status: row.status, total, paid,
    due: row.status === "partial" ? Math.max(total - paid, 0) : 0,
    createdAt: row.created_at, customer: customer?.name ?? "Khách lẻ",
    customerPhone: customer?.phone ?? "", note: row.note ?? "", closeNote: row.close_note ?? "",
    subtotal: Number(row.subtotal), discount: Number(row.discount),
    cashier: one<{ name: string }>(row.cashier)?.name ?? "", branch: one<{ name: string }>(row.branches)?.name ?? "",
    store: { name: store?.name ?? "", phone: store?.phone ?? "", address: store?.address ?? "" },
    items: (items ?? []).map((it) => {
      const p = one<{ name: string; sku: string }>(it.products as never);
      return {
        name: p?.name ?? "", sku: p?.sku ?? "", quantity: it.quantity,
        unitPrice: Number(it.unit_price), discount: Number(it.discount),
      };
    }),
    payments,
  };
}

export async function listBranches(storeId?: string): Promise<Branch[]> {
  if (!isSupabaseConfigured()) return [];
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  const { data, error } = await getAdminClient()
    .from("branches").select("id, name, is_default").eq("store_id", sid)
    .order("is_default", { ascending: false }).order("name");
  if (error) throw error;
  return (data ?? []).map((b) => ({ id: b.id, name: b.name, isDefault: b.is_default }));
}

export async function listSuppliers(storeId?: string): Promise<Supplier[]> {
  if (!isSupabaseConfigured()) return [];
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  const { data, error } = await getAdminClient()
    .from("v_suppliers").select("id, name, phone, address, note, debt, purchases")
    .eq("store_id", sid).order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, name: r.name, phone: r.phone ?? "", address: r.address ?? "", note: r.note ?? "",
    debt: Number(r.debt), purchases: Number(r.purchases),
  }));
}

export async function listPurchases(storeId?: string): Promise<PurchaseRow[]> {
  if (!isSupabaseConfigured()) return [];
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  const { data, error } = await getAdminClient()
    .from("purchase_orders")
    .select("id, code, total, paid, note, created_at, suppliers(name), branches(name)")
    .eq("store_id", sid).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, code: r.code, total: Number(r.total), paid: Number(r.paid), note: r.note ?? "",
    createdAt: r.created_at,
    supplier: one<{ name: string }>(r.suppliers as never)?.name ?? "—",
    branch: one<{ name: string }>(r.branches as never)?.name ?? "",
  }));
}

/** Lịch sử chuyển kho (mỗi lần chuyển = một dòng xuất + một dòng nhập; lấy dòng xuất). */
export async function listTransfers(storeId?: string): Promise<TransferRow[]> {
  if (!isSupabaseConfigured()) return [];
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  const db = getAdminClient();
  const { data, error } = await db
    .from("stock_movements")
    .select("id, quantity, note, created_at, product_id, branch_id, products(name, sku), branches(name)")
    .eq("store_id", sid).eq("type", "transfer_out")
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  const outs = data ?? [];
  if (outs.length === 0) return [];
  const { data: ins } = await db
    .from("stock_movements").select("product_id, created_at, branches(name)")
    .eq("store_id", sid).eq("type", "transfer_in")
    .in("created_at", outs.map((o) => o.created_at));
  return outs.map((o) => {
    const dest = (ins ?? []).find((i) => i.product_id === o.product_id && i.created_at === o.created_at);
    const p = one<{ name: string; sku: string }>(o.products as never);
    return {
      id: o.id, product: p?.name ?? "", sku: p?.sku ?? "",
      from: one<{ name: string }>(o.branches as never)?.name ?? "",
      to: dest ? (one<{ name: string }>(dest.branches as never)?.name ?? "") : "",
      quantity: Math.abs(o.quantity), note: o.note ?? "", createdAt: o.created_at,
    };
  });
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

type ProductRow = {
  id: string; sku: string; name: string; kind: Product["kind"]; price: number | string; cost: number | string;
  min_stock: number; image_url: string | null; active: boolean; package_sessions: number | null;
  product_categories: { name: string } | { name: string }[] | null;
};

function toDetail(r: ProductRow): ProductDetail {
  const c = Array.isArray(r.product_categories) ? r.product_categories[0] : r.product_categories;
  return {
    id: r.id, sku: r.sku, name: r.name, kind: r.kind, category: c?.name ?? "",
    price: Number(r.price), cost: Number(r.cost), stock: null, minStock: r.min_stock,
    imageUrl: r.image_url, active: r.active, sessions: r.package_sessions,
  };
}

const DETAIL_COLUMNS =
  "id, sku, name, kind, price, cost, min_stock, image_url, active, package_sessions, product_categories(name)";

/** Một sản phẩm (kể cả đã ngừng bán) để xem/sửa. */
export async function getProduct(id: string, storeId?: string): Promise<ProductDetail | null> {
  if (!isSupabaseConfigured()) {
    const p = demoProducts.find((x) => x.id === id);
    return p ? { ...p, active: true, sessions: null } : null;
  }
  const sid = await resolveStore(storeId);
  if (!sid || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await getAdminClient()
    .from("products").select(DETAIL_COLUMNS).eq("store_id", sid).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toDetail(data as unknown as ProductRow) : null;
}

/** Sản phẩm đã ngừng bán. */
export async function listInactiveProducts(storeId?: string): Promise<ProductDetail[]> {
  if (!isSupabaseConfigured()) return [];
  const sid = await resolveStore(storeId);
  if (!sid) return [];
  const { data, error } = await getAdminClient()
    .from("products").select(DETAIL_COLUMNS).eq("store_id", sid).eq("active", false).order("name");
  if (error) throw error;
  return (data ?? []).map((r) => toDetail(r as unknown as ProductRow));
}
