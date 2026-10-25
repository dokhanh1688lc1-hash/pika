"use client";

import { Menu, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, PINNED } from "@/components/nav";

/** Thanh công cụ cho điện thoại: tiêu đề phía trên + thanh tab phía dưới + bảng menu đầy đủ. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const current = NAV.find((n) => pathname.startsWith(n.href));
  const pinned = NAV.filter((n) => (PINNED as readonly string[]).includes(n.href));
  const isActive = (href: string) => pathname.startsWith(href);
  const inMenuOnly = !!current && !pinned.some((p) => p.href === current.href);

  return (
    <div className="md:hidden print:hidden">
      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-white">
          <Sparkles size={14} />
        </span>
        <span className="font-semibold text-brand-700">PiKa Store</span>
        {current && <span className="ml-auto truncate text-sm text-slate-500">{current.label}</span>}
      </header>

      <nav
        aria-label="Điều hướng chính"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        {pinned.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
              isActive(href) ? "font-medium text-brand-700" : "text-slate-500"
            }`}
          >
            <Icon size={20} />
            <span className="max-w-full truncate px-1">{label.replace(" (POS)", "")}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
            inMenuOnly ? "font-medium text-brand-700" : "text-slate-500"
          }`}
        >
          <Menu size={20} />
          Menu
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-slate-900/50" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">Tất cả chức năng</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center text-xs ${
                    isActive(href) ? "bg-brand-100 font-medium text-brand-700" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  <Icon size={22} />
                  {label.replace(" (POS)", "")}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
