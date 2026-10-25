import { Field, Notice, PageHeader, SubmitButton, Table, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { listSuppliers } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { vnd } from "@/lib/format";
import { can } from "@/lib/rbac";
import { createSupplier, deleteSupplier, paySupplier, updateSupplier } from "./actions";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const [suppliers, member] = await Promise.all([
    listSuppliers(),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  const canEdit = member ? can(member.role, "inventory.manage") : false;
  const totalDebt = suppliers.reduce((a, s) => a + s.debt, 0);

  return (
    <>
      <PageHeader
        title="Nhà cung cấp"
        subtitle={`Công nợ phải trả hiện tại: ${vnd(totalDebt)}. Công nợ phát sinh khi tạo phiếu nhập mà chưa trả đủ.`}
      />
      <Notice error={error} ok={ok} />

      {canEdit && (
        <details className="card mb-6">
          <summary className="cursor-pointer font-medium">+ Thêm nhà cung cấp</summary>
          <form action={createSupplier} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Tên *"><input name="name" required className={inputClass} /></Field>
            <Field label="Điện thoại"><input name="phone" inputMode="tel" className={inputClass} /></Field>
            <Field label="Địa chỉ"><input name="address" className={inputClass} /></Field>
            <Field label="Ghi chú"><input name="note" className={inputClass} /></Field>
            <div className="sm:col-span-2"><SubmitButton>Lưu nhà cung cấp</SubmitButton></div>
          </form>
        </details>
      )}

      <Table head={["Nhà cung cấp", "Điện thoại", "Số phiếu nhập", "Công nợ", ""]}>
        {suppliers.map((s) => (
          <tr key={s.id} className="align-top">
            <td className="td font-medium">
              {s.name}
              {s.address && <div className="text-xs font-normal text-slate-500">{s.address}</div>}
            </td>
            <td className="td">{s.phone || "—"}</td>
            <td className="td">{s.purchases}</td>
            <td className="td">{s.debt > 0 ? <span className="font-medium text-amber-700">{vnd(s.debt)}</span> : "—"}</td>
            <td className="td">
              {canEdit && (
                <details>
                  <summary className="cursor-pointer text-brand-700">Quản lý</summary>
                  <div className="mt-3 w-72 space-y-4">
                    {s.debt > 0 && (
                      <form action={paySupplier} className="space-y-2">
                        <input type="hidden" name="id" value={s.id} />
                        <Field label="Trả nợ (đ)">
                          <input name="amount" inputMode="numeric" required defaultValue={String(s.debt)} className={inputClass} />
                        </Field>
                        <SubmitButton>Trả nợ</SubmitButton>
                      </form>
                    )}
                    <form action={updateSupplier} className="space-y-2">
                      <input type="hidden" name="id" value={s.id} />
                      <Field label="Tên"><input name="name" required defaultValue={s.name} className={inputClass} /></Field>
                      <Field label="Điện thoại"><input name="phone" defaultValue={s.phone} className={inputClass} /></Field>
                      <Field label="Địa chỉ"><input name="address" defaultValue={s.address} className={inputClass} /></Field>
                      <Field label="Ghi chú"><input name="note" defaultValue={s.note} className={inputClass} /></Field>
                      <SubmitButton>Lưu</SubmitButton>
                    </form>
                    <form action={deleteSupplier}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-sm text-rose-700 hover:underline">Xoá nhà cung cấp</button>
                    </form>
                  </div>
                </details>
              )}
            </td>
          </tr>
        ))}
        {suppliers.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={5}>Chưa có nhà cung cấp nào.</td></tr>
        )}
      </Table>
    </>
  );
}
