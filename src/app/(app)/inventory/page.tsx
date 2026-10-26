import Link from "next/link";
import { Field, Notice, PageHeader, SubmitButton, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { listProducts } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { can } from "@/lib/rbac";
import { StockTable } from "@/components/StockTable";
import { bulkStockEdit, editStockItem, multiEditStock, stockCount, stockIn } from "./actions";

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
      <div className="mb-4 flex flex-wrap gap-2">
        <a href="/api/excel/export?type=stock" className="btn-secondary">Xuất Excel</a>
        {canEdit && <Link href="/inventory/import" className="btn-secondary">Nhập Excel</Link>}
      </div>
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

      <StockTable
        items={items.map((p) => ({ id: p.id, sku: p.sku, name: p.name, stock: p.stock ?? 0, minStock: p.minStock, cost: p.cost, category: p.category }))}
        canEdit={canEdit}
        editAction={editStockItem}
        bulkAction={bulkStockEdit}
        multiAction={multiEditStock}
      />
    </>
  );
}
