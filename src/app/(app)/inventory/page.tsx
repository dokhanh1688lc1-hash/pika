import { Badge, Field, Notice, PageHeader, SubmitButton, Table, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { listProducts } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { can } from "@/lib/rbac";
import { stockCount, stockIn } from "./actions";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const [all, member] = await Promise.all([
    listProducts(),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  const items = all.filter((p) => p.stock !== null);
  const canEdit = member ? can(member.role, "inventory.manage") : false;

  return (
    <>
      <PageHeader title="Kho" subtitle="Tồn kho chi nhánh chính: nhập hàng và kiểm kho" />
      <Notice error={error} ok={ok} />

      {canEdit && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <form action={stockIn} className="card space-y-3">
            <h2 className="font-medium">Nhập kho</h2>
            <Field label="Sản phẩm">
              <select name="productId" required className={inputClass} defaultValue="">
                <option value="" disabled>— Chọn —</option>
                {items.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Số lượng nhập"><input name="qty" inputMode="numeric" required className={inputClass} /></Field>
              <Field label="Giá nhập (đ/đv)"><input name="unitCost" inputMode="numeric" className={inputClass} placeholder="Tuỳ chọn" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hạn sử dụng (nếu có)"><input name="expiry" type="date" className={inputClass} /></Field>
              <Field label="Số lô"><input name="batchCode" className={inputClass} placeholder="Tuỳ chọn" /></Field>
            </div>
            <Field label="Ghi chú"><input name="note" className={inputClass} /></Field>
            <SubmitButton>Nhập kho</SubmitButton>
          </form>

          <form action={stockCount} className="card space-y-3">
            <h2 className="font-medium">Kiểm kho (đặt đúng số đã đếm)</h2>
            <Field label="Sản phẩm">
              <select name="productId" required className={inputClass} defaultValue="">
                <option value="" disabled>— Chọn —</option>
                {items.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name} (đang {p.stock})</option>)}
              </select>
            </Field>
            <Field label="Số lượng thực tế"><input name="qty" inputMode="numeric" required className={inputClass} /></Field>
            <Field label="Ghi chú"><input name="note" className={inputClass} /></Field>
            <SubmitButton>Cập nhật tồn</SubmitButton>
          </form>
        </div>
      )}

      <Table head={["Mã", "Sản phẩm", "Tồn", "Tối thiểu", "Trạng thái"]}>
        {items.map((p) => {
          const low = (p.stock ?? 0) <= p.minStock;
          return (
            <tr key={p.id}>
              <td className="td text-slate-500">{p.sku}</td>
              <td className="td font-medium">{p.name}</td>
              <td className="td">{p.stock}</td>
              <td className="td">{p.minStock}</td>
              <td className="td"><Badge tone={low ? "red" : "green"}>{low ? "Sắp hết" : "Đủ hàng"}</Badge></td>
            </tr>
          );
        })}
        {items.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={5}>Chưa có hàng hoá. Thêm ở mục Hàng hoá & dịch vụ.</td></tr>
        )}
      </Table>
    </>
  );
}
