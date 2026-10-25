import Link from "next/link";
import { Badge, PageHeader, RevenueBars, StatCard, Table } from "@/components/ui";
import { dashboardStats, listExpiring, listTodayAppointments, lowStockProducts } from "@/lib/data/repo";
import { EXPIRY_LABEL, EXPIRY_TONE, daysText, expiryLevel, fmtDate } from "@/lib/expiry";
import { num, vnd } from "@/lib/format";

const STATUS = {
  booked: ["Đã đặt", "blue"],
  in_progress: ["Đang làm", "amber"],
  done: ["Hoàn thành", "green"],
  cancelled: ["Đã huỷ", "red"],
} as const;

export default async function DashboardPage() {
  const [stats, appts, low, expiring] = await Promise.all([
    dashboardStats(), listTodayAppointments(), lowStockProducts(), listExpiring(),
  ]);
  const expiredCount = expiring.filter((b) => b.daysLeft < 0).length;
  return (
    <>
      <PageHeader title="Tổng quan" subtitle="Hoạt động kinh doanh hôm nay" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Doanh thu hôm nay" value={vnd(stats.todayRevenue)} />
        <StatCard label="Số đơn hàng" value={num(stats.todayOrders)} />
        <StatCard label="Khách mới" value={num(stats.newCustomers)} />
        <StatCard label="Sắp hết hàng" value={num(stats.lowStockCount)} hint="Cần nhập thêm" />
        <StatCard
          label="Hạn sử dụng"
          value={num(expiring.length)}
          hint={expiredCount > 0 ? `${expiredCount} lô đã hết hạn` : "lô sắp hết hạn"}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
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
    </>
  );
}
