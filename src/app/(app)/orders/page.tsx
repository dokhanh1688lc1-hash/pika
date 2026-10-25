import Link from "next/link";
import { Badge, Notice, PageHeader, Table } from "@/components/ui";
import { listOrders } from "@/lib/data/repo";
import { vnd } from "@/lib/format";
import { ORDER_STATUS as STATUS } from "@/lib/order-status";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; filter?: string }>;
}) {
  const { error, ok, filter } = await searchParams;
  const debtOnly = filter === "debt";
  const orders = await listOrders(undefined, debtOnly);
  const totalDue = orders.reduce((a, o) => a + o.due, 0);
  const tab = (active: boolean) =>
    `rounded-xl px-3 py-1.5 text-sm ${active ? "bg-brand-100 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100"}`;

  return (
    <>
      <PageHeader title="Đơn hàng" subtitle="100 đơn gần nhất. Bấm mã đơn để xem, in hoá đơn, thu nợ hoặc hoàn/huỷ." />
      <Notice error={error} ok={ok} />
      <div className="mb-4 flex items-center gap-2">
        <Link href="/orders" className={tab(!debtOnly)}>Tất cả</Link>
        <Link href="/orders?filter=debt" className={tab(debtOnly)}>Còn nợ</Link>
        {debtOnly && <span className="ml-2 text-sm text-slate-500">Tổng phải thu: <strong className="text-amber-700">{vnd(totalDue)}</strong></span>}
      </div>
      <Table head={["Mã đơn", "Khách hàng", "Tổng tiền", "Đã thu", "Còn nợ", "Trạng thái", "Thời gian"]}>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="td font-medium">
              <Link href={`/orders/${o.id}`} className="text-brand-700 hover:underline">{o.code}</Link>
            </td>
            <td className="td">{o.customer}</td>
            <td className="td">{vnd(o.total)}</td>
            <td className="td">{vnd(o.paid)}</td>
            <td className="td">{o.due > 0 ? <span className="font-medium text-amber-700">{vnd(o.due)}</span> : "—"}</td>
            <td className="td"><Badge tone={STATUS[o.status][1]}>{STATUS[o.status][0]}</Badge></td>
            <td className="td text-slate-500">
              {new Date(o.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
            </td>
          </tr>
        ))}
        {orders.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={7}>{debtOnly ? "Không có đơn nào còn nợ." : "Chưa có đơn hàng nào."}</td></tr>
        )}
      </Table>
    </>
  );
}
