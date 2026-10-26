import {
  ArrowLeftRight, BarChart3, Bot, CalendarClock, ChevronRight, ClipboardCheck, FileText, Hourglass, LogOut, Package,
  PackagePlus, Settings, ShoppingBag, Truck, UserRound, UserRoundCog, Users, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { getMembership } from "@/lib/auth";
import { getStoreInfo } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { ROLE_LABEL } from "@/lib/rbac";

const SECTIONS: { title: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    title: "Giao dịch",
    items: [
      { href: "/pos", label: "Bán hàng", icon: ShoppingBag },
      { href: "/orders", label: "Hoá đơn", icon: FileText },
      { href: "/appointments", label: "Lịch hẹn", icon: CalendarClock },
      { href: "/customers", label: "Khách hàng", icon: Users },
    ],
  },
  {
    title: "Hàng hoá",
    items: [
      { href: "/products", label: "Hàng hoá", icon: Package },
      { href: "/inventory", label: "Kiểm kho", icon: ClipboardCheck },
      { href: "/purchases", label: "Nhập hàng", icon: PackagePlus },
      { href: "/suppliers", label: "Nhà cung cấp", icon: Truck },
      { href: "/transfers", label: "Chuyển kho", icon: ArrowLeftRight },
      { href: "/expiry", label: "Hạn sử dụng", icon: Hourglass },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { href: "/staff", label: "Nhân viên", icon: UserRound },
      { href: "/reports", label: "Báo cáo", icon: BarChart3 },
      { href: "/ai", label: "Trợ lý AI", icon: Bot },
      { href: "/settings", label: "Cài đặt", icon: Settings },
    ],
  },
];

export default async function MorePage() {
  const [member, store] = await Promise.all([
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
    getStoreInfo(),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="card p-0">
        <div className="flex items-center gap-3 p-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-brand-600"><UserRoundCog size={28} /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{store.name || "PiKa Store"}</p>
            <p className="truncate text-sm text-slate-500">
              {member ? `${member.name} · ${ROLE_LABEL[member.role]}` : "Chế độ demo"}
            </p>
          </div>
        </div>
        <Link href="/settings" className="flex items-center justify-between border-t border-pink-100 px-4 py-3 text-sm">
          Thông tin cửa hàng <ChevronRight size={18} className="text-slate-400" />
        </Link>
      </section>

      {SECTIONS.map((sec) => (
        <section key={sec.title} className="card">
          <h2 className="mb-3 text-lg font-semibold">{sec.title}</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {sec.items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-1 py-3 active:bg-brand-50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600"><Icon size={20} /></span>
                <span className="text-[15px]">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {member && (
        <form action={signOut}>
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-pink-100 bg-white py-3 text-sm text-slate-600">
            <LogOut size={18} /> Đăng xuất
          </button>
        </form>
      )}
    </div>
  );
}
