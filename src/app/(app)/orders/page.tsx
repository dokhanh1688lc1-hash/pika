import { Plus } from "lucide-react";
import Link from "next/link";
import { Badge, Notice, PageHeader, Table } from "@/components/ui";
import { listOrders } from "@/lib/data/repo";
import { vnd } from "@/lib/format";
import { ORDER_STATUS as STATUS, PAY_METHOD } from "@/lib/order-status";
import { addDays, vnToday } from "@/lib/period";

const RANGES = [
  { key: "all", label: "Gần đây" },
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "7d", label: "7 ngày" },
  { key: "month", label: "Tháng này" },
] as const;

function rangeFor(key: string): { from: string; to: string } | undefined {
  const today = vnToday();
  switch (key) {
    case "today": return { from: today, to: today };
    case "yesterday": { const y = addDays(today, -1); return { from: y, to: y }; }
    case "7d": return { from: addDays(today, -6), to: today };
    case "month": return { from: `${today.slice(0, 8)}01`, to: today };
    default: return undefined;
  }
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; filter?: string; range?: string }>;
}) {
  const { error, ok, filter, range = "all" } = await searchParams;
  const debtOnly = filter === "debt";
  const orders = await listOrders(undefined, debtOnly, rangeFor(range));
  const counted = orders.filter((o) => o.status === "paid" || o.status === "partial");
  const totalSales = counted.reduce((a, o) => a + o.total, 0);
  const totalDue = orders.reduce((a, o) => a + o.due, 0);

  const href = (r: string, debt: boolean) => `/orders?range=${r}${debt ? "&filter=debt" : ""}`;
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-sm ${active ? "bg-brand-100 font-medium text-brand-700" : "bg-white text-slate-600 ring-1 ring-pink-100"}`;

  return (
    <>
      <PageHeader title="Hoá đơn" subtitle="Bấm vào hoá đơn để xem, in, thu nợ hoặc hoàn/huỷ." />
      <Notice error={error} ok={ok} />

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <Link href={href(range, !debtOnly)} className={chip(debtOnly)}>Còn nợ</Link>
        {RANGES.map((r) => (
          <Link key={r.key} href={href(r.key, debtOnly)} className={chip(range === r.key)}>{r.label}</Link>
        ))}
      </div>

      <div className="card mb-3 flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">{debtOnly ? "Còn phải thu" : "Tổng tiền hàng"}</p>
          <p className="text-sm text-slate-500">{orders.length} hoá đơn</p>
        </div>
        <p className="text-xl font-semibold">{vnd(debtOnly ? totalDue : totalSales)}</p>
      </div>

      {/* Điện thoại: danh sách thẻ */}
      <ul className="card divide-y divide-pink-100 p-0 md:hidden">
        {orders.map((o) => {
          const [label, tone] = STATUS[o.status];
          return (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="block px-4 py-3 active:bg-brand-50">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-base font-semibold">{o.customer}</p>
                  <p className="shrink-0 text-base font-semibold">{vnd(o.total)}</p>
                </div>
                <div className="mt-0.5 flex items-start justify-between gap-3 text-sm text-slate-500">
                  <p>{fmtTime(o.createdAt)} · {o.code}</p>
                  <p className="shrink-0">{o.method ? PAY_METHOD[o.method] ?? o.method : ""}</p>
                </div>
                {o.firstItem && (
                  <p className="mt-0.5 text-sm text-slate-600">
                    {o.firstItem} <b>x{o.firstQty}</b>
                    {o.moreItems ? <span className="block text-slate-500">+{o.moreItems} mặt hàng khác</span> : null}
                  </p>
                )}
                {(o.status !== "paid" || o.due > 0) && (
                  <div className="mt-1 flex items-center gap-2">
                    <Badge tone={tone}>{label}</Badge>
                    {o.due > 0 && <span className="text-sm font-medium text-amber-700">Nợ {vnd(o.due)}</span>}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
        {orders.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">{debtOnly ? "Không có đơn nào còn nợ." : "Chưa có hoá đơn nào."}</li>}
      </ul>

      {/* Máy tính: bảng */}
      <div className="hidden md:block">
        <Table head={["Mã đơn", "Khách hàng", "Mặt hàng", "Tổng tiền", "Đã thu", "Còn nợ", "Trạng thái", "Thời gian"]}>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="td font-medium">
                <Link href={`/orders/${o.id}`} className="text-brand-700 hover:underline">{o.code}</Link>
              </td>
              <td className="td">{o.customer}</td>
              <td className="td text-slate-500">
                {o.firstItem ? `${o.firstItem} x${o.firstQty}${o.moreItems ? ` +${o.moreItems}` : ""}` : "—"}
              </td>
              <td className="td">{vnd(o.total)}</td>
              <td className="td">{vnd(o.paid)}</td>
              <td className="td">{o.due > 0 ? <span className="font-medium text-amber-700">{vnd(o.due)}</span> : "—"}</td>
              <td className="td"><Badge tone={STATUS[o.status][1]}>{STATUS[o.status][0]}</Badge></td>
              <td className="td text-slate-500">{fmtTime(o.createdAt)}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td className="td text-slate-500" colSpan={8}>{debtOnly ? "Không có đơn nào còn nợ." : "Chưa có hoá đơn nào."}</td></tr>
          )}
        </Table>
      </div>

      <Link
        href="/pos"
        aria-label="Tạo hoá đơn mới"
        className="fixed bottom-24 right-4 z-20 grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-lg active:scale-95 md:hidden print:hidden"
      >
        <Plus size={28} />
      </Link>
    </>
  );
}
