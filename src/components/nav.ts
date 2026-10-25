import {
  ArrowLeftRight, BarChart3, Bot, CalendarClock, Hourglass, LayoutDashboard, Package, PackagePlus,
  Receipt, Settings, ShoppingCart, Truck, UserRound, Users, Warehouse,
} from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/pos", label: "Bán hàng (POS)", icon: ShoppingCart },
  { href: "/orders", label: "Đơn hàng", icon: Receipt },
  { href: "/products", label: "Hàng hoá & dịch vụ", icon: Package },
  { href: "/inventory", label: "Kho", icon: Warehouse },
  { href: "/purchases", label: "Phiếu nhập hàng", icon: PackagePlus },
  { href: "/suppliers", label: "Nhà cung cấp", icon: Truck },
  { href: "/transfers", label: "Chuyển kho", icon: ArrowLeftRight },
  { href: "/expiry", label: "Hạn sử dụng", icon: Hourglass },
  { href: "/customers", label: "Khách hàng", icon: Users },
  { href: "/appointments", label: "Lịch hẹn", icon: CalendarClock },
  { href: "/staff", label: "Nhân viên", icon: UserRound },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/ai", label: "Trợ lý AI", icon: Bot },
  { href: "/settings", label: "Cài đặt", icon: Settings },
] as const;

/** 4 mục hay dùng nhất, ghim ở thanh dưới trên điện thoại (mục thứ 5 là "Menu"). */
export const PINNED = ["/dashboard", "/pos", "/orders", "/appointments"] as const;

/** Nhóm mục trên thanh bên (màn hình lớn) để dễ tìm hơn. */
export const GROUPS: { title: string; hrefs: string[] }[] = [
  { title: "Bán hàng", hrefs: ["/dashboard", "/pos", "/orders", "/appointments"] },
  { title: "Hàng hoá & kho", hrefs: ["/products", "/inventory", "/purchases", "/suppliers", "/transfers", "/expiry"] },
  { title: "Khách hàng & nhân sự", hrefs: ["/customers", "/staff"] },
  { title: "Quản trị", hrefs: ["/reports", "/ai", "/settings"] },
];
