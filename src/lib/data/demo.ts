import type { Appointment, BatchRow, Customer, DashboardStats, Product, StaffMember } from "./types";

export const demoProducts: Product[] = [
  { id: "p1", sku: "SP001", name: "Serum Vitamin C 30ml", kind: "goods", category: "Chăm sóc da", price: 450000, cost: 220000, stock: 24, minStock: 10 },
  { id: "p2", sku: "SP002", name: "Kem chống nắng SPF50", kind: "goods", category: "Chăm sóc da", price: 320000, cost: 150000, stock: 6, minStock: 10 },
  { id: "p3", sku: "SP003", name: "Mặt nạ cấp ẩm (hộp 10)", kind: "goods", category: "Chăm sóc da", price: 180000, cost: 80000, stock: 41, minStock: 15 },
  { id: "p4", sku: "SP004", name: "Dầu gội phục hồi 500ml", kind: "goods", category: "Chăm sóc tóc", price: 280000, cost: 130000, stock: 3, minStock: 8 },
  { id: "dv1", sku: "DV001", name: "Chăm sóc da cơ bản 60'", kind: "service", category: "Spa", price: 350000, cost: 0, stock: null, minStock: 0 },
  { id: "dv2", sku: "DV002", name: "Nối mi Classic", kind: "service", category: "Mi", price: 500000, cost: 0, stock: null, minStock: 0 },
  { id: "dv3", sku: "DV003", name: "Gội đầu dưỡng sinh", kind: "service", category: "Tóc", price: 150000, cost: 0, stock: null, minStock: 0 },
  { id: "lt1", sku: "LT001", name: "Liệu trình trị mụn 10 buổi", kind: "package", category: "Liệu trình", price: 3200000, cost: 0, stock: null, minStock: 0 },
];

export const demoCustomers: Customer[] = [
  { id: "c1", name: "Nguyễn Thị Lan", phone: "0901234567", tier: "Vàng", points: 450, totalSpent: 12500000, lastVisit: "2026-10-22" },
  { id: "c2", name: "Trần Minh Anh", phone: "0912345678", tier: "Bạc", points: 180, totalSpent: 4200000, lastVisit: "2026-10-19" },
  { id: "c3", name: "Lê Hoài Thu", phone: "0987654321", tier: "Kim cương", points: 1200, totalSpent: 38000000, lastVisit: "2026-10-24" },
  { id: "c4", name: "Phạm Ngọc Hà", phone: "0933445566", tier: "Thường", points: 40, totalSpent: 850000, lastVisit: "2026-10-10" },
];

export const demoAppointments: Appointment[] = [
  { id: "a1", time: "09:00", customer: "Nguyễn Thị Lan", service: "Chăm sóc da cơ bản 60'", staff: "Hương", status: "done" },
  { id: "a2", time: "10:30", customer: "Lê Hoài Thu", service: "Nối mi Classic", staff: "Mai", status: "in_progress" },
  { id: "a3", time: "14:00", customer: "Trần Minh Anh", service: "Gội đầu dưỡng sinh", staff: "Hương", status: "booked" },
  { id: "a4", time: "16:00", customer: "Phạm Ngọc Hà", service: "Liệu trình trị mụn (buổi 3/10)", staff: "Mai", status: "booked" },
];

export const demoStaff: StaffMember[] = [
  { id: "s1", name: "Hương", role: "Kỹ thuật viên", commissionRate: 0.1, monthRevenue: 28400000 },
  { id: "s2", name: "Mai", role: "Kỹ thuật viên", commissionRate: 0.1, monthRevenue: 31200000 },
  { id: "s3", name: "Linh", role: "Thu ngân", commissionRate: 0.02, monthRevenue: 54000000 },
];

export const demoStats: DashboardStats = {
  todayRevenue: 6850000,
  todayOrders: 14,
  newCustomers: 3,
  lowStockCount: 2,
  last7Days: [
    { label: "T2", revenue: 4200000 },
    { label: "T3", revenue: 5100000 },
    { label: "T4", revenue: 3800000 },
    { label: "T5", revenue: 6200000 },
    { label: "T6", revenue: 7400000 },
    { label: "T7", revenue: 9100000 },
    { label: "CN", revenue: 6850000 },
  ],
};

export const demoBatches: BatchRow[] = [
  { id: "b1", sku: "SP003", product: "Mặt nạ cấp ẩm (hộp 10)", batchCode: "L2409", quantity: 6, expiryDate: "2026-10-20", daysLeft: -6 },
  { id: "b2", sku: "SP002", product: "Kem chống nắng SPF50", batchCode: "L2501", quantity: 4, expiryDate: "2026-10-31", daysLeft: 5 },
  { id: "b3", sku: "SP001", product: "Serum Vitamin C 30ml", batchCode: "L2503", quantity: 12, expiryDate: "2026-11-18", daysLeft: 23 },
];
