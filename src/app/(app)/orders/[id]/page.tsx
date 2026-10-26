import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { Badge, Field, Notice, SubmitButton, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { getOrder, getStoreInfo } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { vnd } from "@/lib/format";
import { ORDER_STATUS, PAY_METHOD } from "@/lib/order-status";
import { can } from "@/lib/rbac";
import { vietQrUrl } from "@/lib/vietqr";
import { collectDebt, voidOrder } from "../actions";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string; print?: string }>;
}) {
  const [{ id }, { error, ok, print }] = await Promise.all([params, searchParams]);
  const [order, member, store] = await Promise.all([
    getOrder(id),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
    getStoreInfo(),
  ]);
  if (!order) notFound();
  const canCollect = !!member && can(member.role, "pos.sell") && order.status === "partial";
  const canVoid = !!member && can(member.role, "orders.refund") && (order.status === "paid" || order.status === "partial");
  const [label, tone] = ORDER_STATUS[order.status];
  const when = new Date(order.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const closed = order.status === "refunded" || order.status === "cancelled";
  const qrAmount = order.due > 0 ? order.due : order.total;

  return (
    <>
      {print === "1" && <AutoPrint />}
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <div>
          <Link href="/orders" className="text-sm text-slate-500 hover:underline">← Đơn hàng</Link>
          <h1 className="mt-1 text-2xl font-semibold">
            {order.code} <Badge tone={tone}>{label}</Badge>
          </h1>
        </div>
        <PrintButton />
      </div>
      <div className="print:hidden"><Notice error={error} ok={ok} /></div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr] print:block">
        {/* Hoá đơn: khổ hẹp kiểu máy in bill, in ra không kèm các nút bên cạnh */}
        <section className="card font-mono text-[13px] leading-relaxed print:border-0 print:p-0 print:shadow-none" id="invoice">
          <div className="text-center">
            <p className="text-base font-bold">{order.store.name || "Cửa hàng"}</p>
            {order.store.address && <p>{order.store.address}</p>}
            {order.store.phone && <p>ĐT: {order.store.phone}</p>}
            <p className="mt-2 text-sm font-bold">
              {closed ? (order.status === "cancelled" ? "HOÁ ĐƠN ĐÃ HUỶ" : "HOÁ ĐƠN ĐÃ HOÀN TIỀN") : "HOÁ ĐƠN BÁN HÀNG"}
            </p>
          </div>
          <div className="my-3 border-y border-dashed border-slate-400 py-2">
            <p>Số: {order.code}</p>
            <p>Ngày: {when}</p>
            {order.branch && <p>Chi nhánh: {order.branch}</p>}
            {order.cashier && <p>Thu ngân: {order.cashier}</p>}
            <p>Khách: {order.customer}{order.customerPhone ? ` - ${order.customerPhone}` : ""}</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-dashed border-slate-400 text-left">
                <th className="py-1 font-medium">Mặt hàng</th>
                <th className="py-1 text-right font-medium">SL</th>
                <th className="py-1 text-right font-medium">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, i) => (
                <tr key={i} className="align-top">
                  <td className="py-1 pr-2">
                    {it.name}
                    {it.description && <div className="text-xs text-slate-500">{it.description.length > 140 ? `${it.description.slice(0, 140)}…` : it.description}</div>}
                    <div className="text-slate-500">
                      {vnd(it.unitPrice)}{it.discount > 0 ? ` (giảm ${vnd(it.discount)})` : ""}
                    </div>
                  </td>
                  <td className="py-1 text-right">{it.quantity}</td>
                  <td className="py-1 text-right">{vnd(it.quantity * it.unitPrice - it.discount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 space-y-0.5 border-t border-dashed border-slate-400 pt-2">
            <Row k="Tạm tính" v={vnd(order.subtotal)} />
            {order.discount > 0 && <Row k="Giảm giá" v={`-${vnd(order.discount)}`} />}
            <Row k="Tổng cộng" v={vnd(order.total)} bold />
            {order.payments.map((p, i) => (
              <Row key={i} k={`${p.amount < 0 ? "Hoàn" : "Đã thu"} (${PAY_METHOD[p.method] ?? p.method})`} v={vnd(Math.abs(p.amount))} />
            ))}
            {order.due > 0 && <Row k="CÒN NỢ" v={vnd(order.due)} bold />}
          </div>
          {store.bank && !closed && (
            <div className="mt-3 border-t border-dashed border-slate-400 pt-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={vietQrUrl(store.bank, qrAmount, order.code)} alt="Mã QR thanh toán" className="mx-auto w-40" />
              <p className="mt-1 font-bold">{order.due > 0 ? "Còn phải thanh toán" : "Tổng thanh toán"}: {vnd(qrAmount)}</p>
              <p>Quét mã QR để chuyển khoản</p>
              <p className="text-slate-500">{store.bank.holder} · {store.bank.account}</p>
            </div>
          )}
          {order.note && <p className="mt-2">Ghi chú: {order.note}</p>}
          {order.closeNote && <p className="mt-1">Lý do hoàn/huỷ: {order.closeNote}</p>}
          <p className="mt-4 text-center">Cảm ơn quý khách!</p>
        </section>

        <div className="space-y-6 print:hidden">
          {canCollect && (
            <form action={collectDebt} className="card space-y-3">
              <h2 className="font-medium">Thu nợ</h2>
              <p className="text-sm text-slate-500">Khách còn nợ <strong className="text-amber-700">{vnd(order.due)}</strong>. Thu một phần hoặc toàn bộ.</p>
              <input type="hidden" name="id" value={order.id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Số tiền thu (đ)">
                  <input name="amount" inputMode="numeric" required defaultValue={String(order.due)} className={inputClass} />
                </Field>
                <Field label="Hình thức">
                  <select name="method" className={inputClass} defaultValue="cash">
                    <option value="cash">Tiền mặt</option>
                    <option value="transfer">Chuyển khoản</option>
                    <option value="card">Thẻ</option>
                    <option value="ewallet">Ví điện tử</option>
                  </select>
                </Field>
              </div>
              <SubmitButton>Thu tiền</SubmitButton>
            </form>
          )}

          {canVoid && (
            <form action={voidOrder} className="card space-y-3">
              <h2 className="font-medium">Hoàn tiền / huỷ đơn</h2>
              <p className="text-sm text-slate-500">
                Hàng được nhập lại kho, tiền trả khách theo đúng hình thức đã thu, điểm và chi tiêu của khách bị thu hồi.
                Liệu trình khách đã dùng buổi thì không hoàn được. Không thể hoàn tác.
              </p>
              <input type="hidden" name="id" value={order.id} />
              <Field label="Thao tác">
                <select name="kind" className={inputClass} defaultValue="refunded">
                  <option value="refunded">Hoàn tiền (khách trả lại hàng)</option>
                  <option value="cancelled">Huỷ đơn (lập sai, khách không lấy)</option>
                </select>
              </Field>
              <Field label="Lý do"><input name="note" className={inputClass} /></Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="confirm" value="1" required /> Tôi hiểu thao tác này không thể hoàn tác
              </label>
              <button className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                Thực hiện
              </button>
            </form>
          )}

          {!canCollect && !canVoid && (
            <p className="card text-sm text-slate-500">
              {closed ? "Đơn đã được đóng, không còn thao tác nào." : "Bạn không có thao tác nào với đơn này."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "font-bold" : ""}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
