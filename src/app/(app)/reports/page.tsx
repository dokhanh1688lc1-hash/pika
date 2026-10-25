import Link from "next/link";
import { Notice, PageHeader, RevenueBars, StatCard, SubmitButton, Table, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { reportSummary } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { num, vnd } from "@/lib/format";
import { RANGES, resolvePeriod } from "@/lib/period";
import { ROLE_LABEL, can, type Role } from "@/lib/rbac";

const dmy = (iso: string) => iso.split("-").reverse().join("/");

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const configured = isSupabaseConfigured();
  const member = configured ? await getMembership() : null;
  const allowed = !configured || (!!member && can(member.role, "reports.view"));

  let report: Awaited<ReturnType<typeof reportSummary>> = null;
  let failure = "";
  if (configured && allowed) {
    try {
      report = await reportSummary(period.from, period.to);
    } catch (e) {
      failure = e instanceof Error ? e.message : "Không tải được báo cáo.";
    }
  }

  const tab = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm ${active ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"}`;

  if (!allowed) {
    return (
      <>
        <PageHeader title="Báo cáo" />
        <p className="card text-sm text-slate-500">Bạn không có quyền xem báo cáo.</p>
      </>
    );
  }

  const profit = report ? report.revenue - report.cogs : 0;
  const margin = report && report.revenue > 0 ? (profit / report.revenue) * 100 : 0;
  const totalCommission = report?.staff.reduce((a, s) => a + s.commission, 0) ?? 0;
  const exportHref = `/api/reports/export?from=${period.from}&to=${period.to}`;

  return (
    <>
      <PageHeader
        title="Báo cáo"
        subtitle={`Từ ${dmy(period.from)} đến ${dmy(period.to)} · tính theo giờ Việt Nam`}
        action={
          configured && report ? (
            <a href={exportHref} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Xuất Excel
            </a>
          ) : undefined
        }
      />
      <Notice error={failure || undefined} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Link key={r.key} href={`/reports?range=${r.key}`} className={tab(period.range === r.key)}>{r.label}</Link>
        ))}
        <form className="ml-auto flex flex-wrap items-center gap-2 text-sm" action="/reports">
          <input type="date" name="from" defaultValue={period.from} required className={`${inputClass} !w-auto`} />
          <span className="text-slate-400">→</span>
          <input type="date" name="to" defaultValue={period.to} required className={`${inputClass} !w-auto`} />
          <SubmitButton>Xem</SubmitButton>
        </form>
      </div>

      {!configured && (
        <p className="card text-sm text-slate-500">Kết nối Supabase để xem báo cáo từ dữ liệu thật.</p>
      )}

      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Doanh thu" value={vnd(report.revenue)} hint={`${num(report.orders)} đơn`} />
            <StatCard label="Giá vốn hàng bán" value={vnd(report.cogs)} hint="theo giá vốn hiện tại" />
            <StatCard label="Lợi nhuận gộp" value={vnd(profit)} hint={`Biên lợi nhuận ${margin.toFixed(1)}%`} />
            <StatCard label="Hoa hồng nhân viên" value={vnd(totalCommission)} hint="tạm tính theo kỳ" />
          </div>

          <section className="card mt-6">
            <h2 className="mb-3 font-medium">Kết quả kinh doanh</h2>
            <dl className="divide-y divide-slate-100 text-sm">
              <Line k="Doanh thu bán hàng" v={vnd(report.revenue)} />
              <Line k="Giá vốn hàng bán" v={`−${vnd(report.cogs)}`} />
              <Line k="Lợi nhuận gộp" v={vnd(profit)} bold />
              <Line k="Hoa hồng nhân viên (tạm tính)" v={`−${vnd(totalCommission)}`} />
              <Line k="Lợi nhuận sau hoa hồng" v={vnd(profit - totalCommission)} bold />
            </dl>
            <dl className="mt-4 grid gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
              <Mini k="Giảm giá đã cho" v={vnd(report.discount)} />
              <Mini k={`Đơn hoàn tiền (${report.refundCount})`} v={vnd(report.refundAmount)} />
              <Mini k="Tiền nhập hàng trong kỳ" v={vnd(report.purchases)} />
              <Mini k="Khách mới" v={num(report.newCustomers)} />
            </dl>
            <p className="mt-3 text-xs text-slate-400">
              Doanh thu gồm cả đơn còn nợ, không gồm đơn đã hoàn / huỷ. Giá vốn lấy theo giá vốn hiện tại của từng sản phẩm.
              Hoa hồng tính trên các dòng hàng có gắn nhân viên thực hiện.
            </p>
          </section>

          {report.days.length <= 31 && (
            <section className="card mt-6">
              <h2 className="mb-4 font-medium">Doanh thu theo ngày</h2>
              <RevenueBars data={report.days.map((d) => ({ label: d.day.slice(8), revenue: d.revenue }))} />
            </section>
          )}

          <h2 className="mb-3 mt-8 font-medium">Hoa hồng nhân viên</h2>
          <Table head={["Nhân viên", "Vai trò", "Doanh thu", "% hoa hồng", "Hoa hồng"]}>
            {report.staff.map((s) => (
              <tr key={s.name}>
                <td className="td font-medium">{s.name}</td>
                <td className="td">{ROLE_LABEL[s.role as Role] ?? s.role}</td>
                <td className="td">{vnd(s.revenue)}</td>
                <td className="td">{(s.rate * 100).toFixed(1)}%</td>
                <td className="td font-medium">{vnd(s.commission)}</td>
              </tr>
            ))}
            {report.staff.length === 0 && (
              <tr><td className="td text-slate-500" colSpan={5}>Chưa có dòng hàng nào gắn nhân viên trong kỳ này.</td></tr>
            )}
          </Table>

          <h2 className="mb-3 mt-8 font-medium">Sản phẩm bán chạy</h2>
          <Table head={["Sản phẩm", "Số lượng", "Doanh thu", "Giá vốn", "Lãi gộp"]}>
            {report.products.slice(0, 20).map((p) => (
              <tr key={p.sku}>
                <td className="td"><span className="font-medium">{p.name}</span> <span className="text-slate-400">{p.sku}</span></td>
                <td className="td">{num(p.quantity)}</td>
                <td className="td">{vnd(p.revenue)}</td>
                <td className="td">{vnd(p.cost)}</td>
                <td className="td">{vnd(p.revenue - p.cost)}</td>
              </tr>
            ))}
            {report.products.length === 0 && (
              <tr><td className="td text-slate-500" colSpan={5}>Chưa có đơn hàng trong kỳ này.</td></tr>
            )}
          </Table>
        </>
      )}
    </>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${bold ? "font-semibold" : ""}`}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{k}</dt>
      <dd className="font-medium text-slate-700">{v}</dd>
    </div>
  );
}
