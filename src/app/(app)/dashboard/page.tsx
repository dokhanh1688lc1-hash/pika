import { CalendarClock, FileText, Package, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Badge, PageHeader, RevenueBars, StatCard, Table } from "@/components/ui";
import { dashboardStats, listExpiring, listTodayAppointments, lowStockProducts, totalReceivable } from "@/lib/data/repo";
import { EXPIRY_LABEL, EXPIRY_TONE, daysText, expiryLevel, fmtDate } from "@/lib/expiry";
import { num, vnd } from "@/lib/format";

const STATUS = {
  booked: ["Đã đặt", "blue"],
  in_progress: ["Đang làm", "amber"],
  done: ["Hoàn thành", "green"],
  cancelled: ["Đã huỷ", "red"],
} as const;

export default async function DashboardPage() {
  const [stats, appts, low, expiring, debt] = await Promise.all([
    dashboardStats(), listTodayAppointments(), lowStockProducts(), listExpiring(), totalReceivable(),
  ]);
  const expiredCount = expiring.filter((b) => b.daysLeft < 0).length;
  return (
    <>
      <PageHeader title="Tổng quan" subtitle="Hoạt động kinh doanh hôm nay" />

      {/* Điện thoại: thẻ doanh thu nổi bật + lối tắt */}
      <div className="md:hidden">
        <div className="rounded-3xl bg-gradient-to-br from-pink-500 to-rose-400 p-5 text-white shadow-md">
          <p className="text-sm opacity-90">Doanh thu hôm nay</p>
          <p className="mt-1 text-3xl font-bold">{vnd(stats.todayRevenue)}</p>
          <p className="mt-2 text-sm opacity-90">{num(stats.todayOrders)} đơn hàng · {num(stats.newCustomers)} khách mới</p>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { href: "/pos", label: "Bán hàng", icon: ShoppingBag },
            { href: "/orders", label: "Hoá đơn", icon: FileText },
            { href: "/products", label: "Hàng hoá", icon: Package },
            { href: "/appointments", label: "Lịch hẹn", icon: CalendarClock },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-3 text-xs ring-1 ring-pink-100 active:bg-brand-50">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-600"><Icon size={22} /></span>
              {label}
            </Link>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href="/inventory" className="card !p-4">
            <p className="text-xs text-slate-500">Sắp hết hàng</p>
            <p className="mt-1 text-xl font-semibold">{num(stats.lowStockCount)}</p>
          </Link>
          <Link href="/expiry" className="card !p-4">
            <p className="text-xs text-slate-500">Lô sắp hết hạn</p>
            <p className="mt-1 text-xl font-semibold">{num(expiring.length)}</p>
            {expiredCount > 0 && <p className="text-xs text-rose-600">{expiredCount} lô đã hết hạn</p>}
          </Link>
          <Link href="/orders?filter=debt" className="card col-span-2 !p-4">
            <p className="text-xs text-slate-500">Khách còn nợ · {debt.count} đơn</p>
            <p className="mt-1 text-xl font-semibold text-amber-700">{vnd(debt.amount)}</p>
          </Link>
        </div>
      </div>

      <div className="hidden gap-4 sm:grid-cols-2 md:grid xl:grid-cols-6">
        <StatCard label="Doanh thu hôm nay" value={vnd(stats.todayRevenue)} />
        <StatCard label="Số đơn hàng" value={num(stats.todayOrders)} />
        <StatCard label="Khách mới" value={num(stats.newCustomers)} />
        <StatCard label="Sắp hết hàng" value={num(stats.lowStockCount)} hint="Cần nhập thêm" />
        <Link href="/orders?filter=debt" className="block">
          <StatCard label="Khách còn nợ" value={vnd(debt.amount)} hint={`${debt.count} đơn chưa thu đủ`} />
        </Link>
        <StatCard
          label="Hạn sử dụng"
          value={num(expiring.length)}
          hint={expiredCount > 0 ? `${expiredCount} lô đã hết hạn` : "lô sắp hết hạn"}
        />
      </div>

      <div className="mt-6 grid gap-4 md:gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <h2 className="mb-4 font-medium">Doanh thu 7 ngày</h2>
          <RevenueBars data={stats.last7Days} />
        </section>
        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-3 font-medium">Cảnh báo tồn kho</h2>
            <ul className="space-y-2 text-sm">
              {low.length === 0 && <li className="text-slate-500">Tồn kho ổn định.</li>}
              {low.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <Badge tone="red">còn {p.stock}</Badge>
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">Cảnh báo hạn sử dụng</h2>
              <Link href="/expiry" className="text-sm text-brand-700 hover:underline">Xem tất cả</Link>
            </div>
            <ul className="space-y-2 text-sm">
              {expiring.length === 0 && <li className="text-slate-500">Không có lô nào sắp hết hạn.</li>}
              {expiring.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">{b.product}</span>
                    <span className="text-xs text-slate-500">
                      {b.quantity} · HSD {fmtDate(b.expiryDate)} ({daysText(b.daysLeft)})
                    </span>
                  </span>
                  <Badge tone={EXPIRY_TONE[expiryLevel(b.daysLeft)]}>{EXPIRY_LABEL[expiryLevel(b.daysLeft)]}</Badge>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-medium">Lịch hẹn hôm nay</h2>
      <ul className="space-y-3 md:hidden">
        {appts.map((a) => (
          <li key={a.id} className="card flex items-center justify-between gap-3 !p-4">
            <div className="min-w-0">
              <p className="font-semibold text-brand-700">{a.time}</p>
              <p className="truncate font-medium">{a.customer}</p>
              <p className="truncate text-sm text-slate-500">{a.service}{a.staff ? ` · ${a.staff}` : ""}</p>
            </div>
            <Badge tone={STATUS[a.status][1]}>{STATUS[a.status][0]}</Badge>
          </li>
        ))}
        {appts.length === 0 && <li className="card py-5 text-center text-sm text-slate-500">Hôm nay chưa có lịch hẹn.</li>}
      </ul>
      <div className="hidden md:block">
      <Table head={["Giờ", "Khách hàng", "Dịch vụ", "Nhân viên", "Trạng thái"]}>
        {appts.map((a) => (
          <tr key={a.id}>
            <td className="td font-medium">{a.time}</td>
            <td className="td">{a.customer}</td>
            <td className="td">{a.service}</td>
            <td className="td">{a.staff}</td>
            <td className="td"><Badge tone={STATUS[a.status][1]}>{STATUS[a.status][0]}</Badge></td>
          </tr>
        ))}
      </Table>
      </div>
    </>
  );
}
