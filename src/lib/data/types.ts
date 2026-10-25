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
  status: "draft" | "paid" | "partial" | "refunded" | "cancelled";
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
