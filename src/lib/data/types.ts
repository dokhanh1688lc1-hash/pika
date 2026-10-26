export type ProductKind = "goods" | "service" | "package";

export interface Product {
  id: string;
  sku: string;
  name: string;
  kind: ProductKind;
  category: string;
  price: number;
  cost: number;
  stock: number | null; // null với dịch vụ / liệu trình
  minStock: number;
  imageUrl?: string | null;
  description?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  tier: "Thường" | "Bạc" | "Vàng" | "Kim cương";
  points: number;
  totalSpent: number;
  lastVisit: string;
}

export interface Appointment {
  id: string;
  time: string;
  customer: string;
  service: string;
  staff: string;
  status: "booked" | "in_progress" | "done" | "cancelled";
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  commissionRate: number;
  monthRevenue: number;
}

export interface DashboardStats {
  todayRevenue: number;
  todayOrders: number;
  newCustomers: number;
  lowStockCount: number;
  last7Days: { label: string; revenue: number }[];
}

export interface OrderRow {
  id: string;
  code: string;
  customer: string;
  total: number;
  paid: number;
  due: number;
  status: OrderStatus;
  createdAt: string;
  /** Mặt hàng đầu tiên, số mặt hàng còn lại và hình thức thanh toán chính (chỉ có ở danh sách đơn) */
  firstItem?: string;
  firstQty?: number;
  moreItems?: number;
  method?: string;
}

export type OrderStatus = "draft" | "paid" | "partial" | "refunded" | "cancelled";

export interface OrderDetail extends OrderRow {
  customerPhone: string;
  note: string;
  subtotal: number;
  discount: number;
  closeNote: string;
  cashier: string;
  branch: string;
  store: { name: string; phone: string; address: string };
  items: { name: string; sku: string; description: string; quantity: number; unitPrice: number; discount: number }[];
  payments: { method: string; amount: number; at: string }[];
}

export interface Branch {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  note: string;
  debt: number;
  purchases: number;
}

export interface PurchaseRow {
  id: string;
  code: string;
  supplier: string;
  branch: string;
  total: number;
  paid: number;
  note: string;
  createdAt: string;
}

export interface TransferRow {
  id: string;
  product: string;
  sku: string;
  from: string;
  to: string;
  quantity: number;
  note: string;
  createdAt: string;
}

export interface BatchRow {
  id: string;
  sku: string;
  product: string;
  batchCode: string;
  quantity: number;
  expiryDate: string; // YYYY-MM-DD
  daysLeft: number;   // âm = đã hết hạn
}

export interface ProductDetail extends Product {
  active: boolean;
  sessions: number | null;
  description: string;
  durationMin: number | null;
}

export interface StoreInfo {
  name: string;
  phone: string;
  address: string;
  bank: { code: string; account: string; holder: string } | null;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday: string;
  note: string;
  tier: string;
  points: number;
  totalSpent: number;
  orders: { id: string; code: string; total: number; status: OrderStatus; createdAt: string }[];
}

export interface ReportSummary {
  revenue: number;
  orders: number;
  discount: number;
  cogs: number;
  refundCount: number;
  refundAmount: number;
  purchases: number;
  newCustomers: number;
  days: { day: string; orders: number; revenue: number; cogs: number }[];
  products: { sku: string; name: string; quantity: number; revenue: number; cost: number }[];
  staff: { name: string; role: string; rate: number; revenue: number; commission: number }[];
}

export type AppointmentStatus = "booked" | "in_progress" | "done" | "cancelled";

export interface AppointmentFull {
  id: string;
  startsAt: string;
  endsAt: string;
  customerId: string;
  customer: string;
  productId: string;
  service: string;
  staffId: string;
  staff: string;
  status: AppointmentStatus;
  note: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  products: number;
}
