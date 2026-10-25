import { Badge, PageHeader, RevenueBars, StatCard, Table } from "@/components/ui";
import { dashboardStats, listTodayAppointments, lowStockProducts } from "@/lib/data/repo";
import { num, vnd } from "@/lib/format";

const STATUS = {
  booked: ["Đã đặt", "blue"],
  in_progress: ["Đang làm", "amber"],
  done: ["Hoàn thành", "green"],
  cancelled: ["Đã huỷ", "red"],
} as const;

export default async function DashboardPage() {
  const [stats, appts, low] = await Promise.all([
    dashboardStats(), listTodayAppointments(), lowStockProducts(),
  ]);
  return (
    <>
      <PageHeader title="Tổng quan" subtitle="Hoạt động kinh doanh hôm nay" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Doanh thu hôm nay" value={vnd(stats.todayRevenue)} />
        <StatCard label="Số đơn hàng" value={num(stats.todayOrders)} />
        <StatCard label="Khách mới" value={num(stats.newCustomers)} />
        <StatCard label="Sắp hết hàng" value={num(stats.lowStockCount)} hint="Cần nhập thêm" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <h2 className="mb-4 font-medium">Doanh thu 7 ngày</h2>
          <RevenueBars data={stats.last7Days} />
        </section>
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
