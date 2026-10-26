"use client";

import { BarChart3, FileText, Menu, Package, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Tổng quan", icon: BarChart3 },
  { href: "/products", label: "Hàng hoá", icon: Package },
  { href: "/pos", label: "Bán hàng", icon: ShoppingBag },
  { href: "/orders", label: "Hoá đơn", icon: FileText },
  { href: "/more", label: "Nhiều hơn", icon: Menu },
] as const;

/** Mục nằm trong "Nhiều hơn" thì tab đó sáng lên. */
const OWN = ["/dashboard", "/products", "/pos", "/orders"];

/** Thanh tab phía dưới cho điện thoại (kiểu app KiotViet); các chức năng còn lại ở trang "Nhiều hơn". */
export function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/more" ? pathname.startsWith("/more") || !OWN.some((o) => pathname.startsWith(o)) : pathname.startsWith(href);

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-pink-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const on = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] ${on ? "font-semibold text-brand-600" : "text-slate-500"}`}
          >
            <Icon size={24} strokeWidth={on ? 2.4 : 1.8} />
            <span className="max-w-full truncate px-1">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
