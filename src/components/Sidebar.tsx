"use client";

import { ChevronsLeft, ChevronsRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { GROUPS, NAV } from "@/components/nav";

const KEY = "pika.sidebar.collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Nhớ lựa chọn thu gọn / mở rộng của người dùng trên trình duyệt này
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(KEY) === "1");
    } catch {
      /* trình duyệt chặn lưu trữ: dùng mặc định */
    }
  }, []);
  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? "0" : "1");
      } catch {
        /* bỏ qua */
      }
      return !c;
    });
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 md:flex print:!hidden ${
        collapsed ? "w-[4.5rem]" : "w-64"
      }`}
    >
      <div className={`flex h-16 shrink-0 items-center gap-2 border-b border-slate-100 ${collapsed ? "justify-center" : "px-5"}`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
          <Sparkles size={18} />
        </span>
        {!collapsed && <span className="text-lg font-semibold text-brand-700">Beauty AI</span>}
      </div>

      {/* Khu vực cuộn: thanh cuộn mảnh, không kéo theo cả trang */}
      <nav aria-label="Điều hướng chính" className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {GROUPS.map((g, gi) => (
          <div key={g.title} className={gi > 0 ? "mt-4" : ""}>
            {collapsed ? (
              gi > 0 && <hr className="mx-2 mb-2 border-slate-100" />
            ) : (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</p>
            )}
            <ul className="space-y-0.5">
              {NAV.filter((n) => g.hrefs.includes(n.href)).map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      title={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center rounded-xl py-2 text-sm transition-colors ${
                        collapsed ? "justify-center px-0" : "gap-3 px-3"
                      } ${
                        active
                          ? "bg-brand-50 font-medium text-brand-700"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" />}
                      <Icon size={19} className="shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={`flex shrink-0 items-center border-t border-slate-100 p-3 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && <span className="px-2 text-xs text-slate-400">v0.1 • Beauty AI</span>}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          title={collapsed ? "Mở rộng" : "Thu gọn"}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}
