import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/ConfirmButton";
import { Badge, Field, Notice, PageHeader, SubmitButton, Table, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { getCustomer } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { num, vnd } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";
import { can } from "@/lib/rbac";
import { deleteCustomer, updateCustomer } from "../actions";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const [{ id }, { error, ok }] = await Promise.all([params, searchParams]);
  const [c, member] = await Promise.all([
    getCustomer(id),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  if (!c) notFound();
  const canEdit = member ? can(member.role, "customers.manage") : false;

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={`${c.tier} · ${num(c.points)} điểm · đã chi ${vnd(c.totalSpent)}`}
        action={
          <Link href="/customers" className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            ← Danh sách
          </Link>
        }
      />
      <Notice error={error} ok={ok} />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-1">
          <h2 className="mb-4 font-medium">Thông tin</h2>
          {canEdit ? (
            <form action={updateCustomer} className="space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Họ tên *"><input name="name" required defaultValue={c.name} className={inputClass} /></Field>
              <Field label="Điện thoại"><input name="phone" inputMode="tel" defaultValue={c.phone} className={inputClass} /></Field>
              <Field label="Email"><input name="email" type="email" defaultValue={c.email} className={inputClass} /></Field>
              <Field label="Ngày sinh"><input name="birthday" type="date" defaultValue={c.birthday} className={inputClass} /></Field>
              <Field label="Ghi chú"><input name="note" defaultValue={c.note} className={inputClass} /></Field>
              <SubmitButton>Lưu thay đổi</SubmitButton>
            </form>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Điện thoại</dt><dd>{c.phone || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd>{c.email || "—"}</dd></div>
            </dl>
          )}
          {canEdit && (
            <ConfirmForm
              action={deleteCustomer}
              hidden={{ id: c.id }}
              message={`Xoá khách hàng "${c.name}"? Thao tác này không thể hoàn tác.`}
            >
              <p className="mt-6 border-t pt-4 text-xs text-slate-500">
                Chỉ xoá được khách chưa có đơn hàng / lịch hẹn và không còn liệu trình dở dang.
              </p>
              <button className="mt-2 text-sm text-rose-700 hover:underline">Xoá khách hàng</button>
            </ConfirmForm>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-3 font-medium">Lịch sử mua hàng (20 đơn gần nhất)</h2>
          <Table head={["Mã đơn", "Tổng tiền", "Trạng thái", "Thời gian"]}>
            {c.orders.map((o) => (
              <tr key={o.id}>
                <td className="td font-medium">
                  <Link href={`/orders/${o.id}`} className="text-brand-700 hover:underline">{o.code}</Link>
                </td>
                <td className="td">{vnd(o.total)}</td>
                <td className="td"><Badge tone={ORDER_STATUS[o.status][1]}>{ORDER_STATUS[o.status][0]}</Badge></td>
                <td className="td text-slate-500">
                  {new Date(o.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                </td>
              </tr>
            ))}
            {c.orders.length === 0 && (
              <tr><td className="td text-slate-500" colSpan={4}>Chưa có đơn hàng nào.</td></tr>
            )}
          </Table>
        </section>
      </div>
    </>
  );
}
