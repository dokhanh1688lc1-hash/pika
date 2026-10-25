"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Bot, CalendarClock, Hourglass, LayoutDashboard, Receipt, Package, Settings, ShoppingCart, Sparkles, UserRound, Users, Warehouse,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/pos", label: "Bán hàng (POS)", icon: ShoppingCart },
  { href: "/orders", label: "Đơn hàng", icon: Receipt },
  { href: "/products", label: "Hàng hoá & dịch vụ", icon: Package },
  { href: "/inventory", label: "Kho", icon: Warehouse },
  { href: "/expiry", label: "Hạn sử dụng", icon: Hourglass },
  { href: "/customers", label: "Khách hàng", icon: Users },
  { href: "/appointments", label: "Lịch hẹn", icon: CalendarClock },
  { href: "/staff", label: "Nhân viên", icon: UserRound },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/ai", label: "Trợ lý AI", icon: Bot },
  { href: "/settings", label: "Cài đặt", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
          <Sparkles size={18} />
        </span>
        <span className="text-lg font-semibold text-brand-700">Beauty AI</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                active ? "bg-brand-100 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="px-2 text-xs text-slate-400">v0.1 • Nền tảng</p>
    </aside>
  );
}
