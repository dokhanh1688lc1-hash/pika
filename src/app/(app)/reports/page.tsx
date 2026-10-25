import { PageHeader, RevenueBars, StatCard } from "@/components/ui";
import { dashboardStats } from "@/lib/data/repo";
import { vnd } from "@/lib/format";

export default async function ReportsPage() {
  const s = await dashboardStats();
  const total = s.last7Days.reduce((a, d) => a + d.revenue, 0);
  return (
    <>
      <PageHeader title="Báo cáo" subtitle="Báo cáo bán hàng, lợi nhuận, công nợ, sổ quỹ sẽ mở rộng ở giai đoạn 2" />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Doanh thu 7 ngày" value={vnd(total)} />
        <StatCard label="Trung bình / ngày" value={vnd(Math.round(total / Math.max(1, s.last7Days.length)))} />
      </div>
      <section className="card mt-6">
        <h2 className="mb-4 font-medium">Doanh thu theo ngày</h2>
        <RevenueBars data={s.last7Days} />
      </section>
    </>
  );
}
