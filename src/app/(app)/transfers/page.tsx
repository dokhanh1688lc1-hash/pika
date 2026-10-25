import { Field, Notice, PageHeader, SubmitButton, Table, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { listBranches, listProducts, listTransfers } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { can } from "@/lib/rbac";
import { createBranch, transferStock } from "./actions";

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const [branches, products, transfers, member] = await Promise.all([
    listBranches(), listProducts(), listTransfers(),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  const goods = products.filter((p) => p.kind === "goods");
  const canTransfer = member ? can(member.role, "inventory.manage") : false;
  const canBranch = member ? can(member.role, "settings.manage") : false;

  return (
    <>
      <PageHeader title="Chuyển kho" subtitle="Chuyển hàng giữa các chi nhánh. Lô cận date đi trước, giữ nguyên hạn sử dụng." />
      <Notice error={error} ok={ok} />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {canTransfer &&
          (branches.length < 2 ? (
            <p className="card text-sm text-slate-500">
              Cần có ít nhất 2 chi nhánh để chuyển kho{canBranch ? ". Hãy thêm chi nhánh ở khung bên cạnh." : ". Nhờ chủ cửa hàng thêm chi nhánh."}
            </p>
          ) : (
            <form action={transferStock} className="card space-y-3">
              <h2 className="font-medium">Tạo phiếu chuyển kho</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Từ chi nhánh">
                  <select name="from" required className={inputClass} defaultValue={branches[0]?.id}>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
                <Field label="Đến chi nhánh">
                  <select name="to" required className={inputClass} defaultValue={branches[1]?.id}>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Sản phẩm">
                <select name="productId" required className={inputClass} defaultValue="">
                  <option value="" disabled>— Chọn —</option>
                  {goods.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
                </select>
              </Field>
              <Field label="Số lượng"><input name="qty" inputMode="numeric" required className={inputClass} /></Field>
              <Field label="Ghi chú"><input name="note" className={inputClass} /></Field>
              <SubmitButton>Chuyển kho</SubmitButton>
            </form>
          ))}

        <div className="card">
          <h2 className="mb-3 font-medium">Chi nhánh</h2>
          <ul className="mb-4 space-y-1 text-sm">
            {branches.map((b) => (
              <li key={b.id}>{b.name}{b.isDefault && <span className="ml-2 text-xs text-slate-400">(chính)</span>}</li>
            ))}
            {branches.length === 0 && <li className="text-slate-500">Chưa có chi nhánh.</li>}
          </ul>
          {canBranch && (
            <form action={createBranch} className="space-y-3 border-t pt-4">
              <Field label="Tên chi nhánh mới"><input name="name" required className={inputClass} /></Field>
              <Field label="Địa chỉ"><input name="address" className={inputClass} /></Field>
              <SubmitButton>Thêm chi nhánh</SubmitButton>
            </form>
          )}
        </div>
      </div>

      <Table head={["Thời gian", "Sản phẩm", "Từ", "Đến", "Số lượng", "Ghi chú"]}>
        {transfers.map((t) => (
          <tr key={t.id}>
            <td className="td text-slate-500">{new Date(t.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td>
            <td className="td font-medium">{t.sku} · {t.product}</td>
            <td className="td">{t.from}</td>
            <td className="td">{t.to}</td>
            <td className="td">{t.quantity}</td>
            <td className="td text-slate-500">{t.note}</td>
          </tr>
        ))}
        {transfers.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={6}>Chưa có lần chuyển kho nào.</td></tr>
        )}
      </Table>
    </>
  );
}
