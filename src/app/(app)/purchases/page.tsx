import { Badge, Notice, PageHeader, Table } from "@/components/ui";
import { PurchaseForm } from "@/components/PurchaseForm";
import { getMembership } from "@/lib/auth";
import { listProducts, listPurchases, listSuppliers } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { vnd } from "@/lib/format";
import { can } from "@/lib/rbac";
import { createPurchase } from "./actions";

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const [products, suppliers, purchases, member] = await Promise.all([
    listProducts(), listSuppliers(), listPurchases(),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  const canEdit = member ? can(member.role, "inventory.manage") : false;
  const goods = products
    .filter((p) => p.kind === "goods")
    .map((p) => ({ id: p.id, sku: p.sku, name: p.name, cost: p.cost }));

  return (
    <>
      <PageHeader title="Phiếu nhập hàng" subtitle="Nhập nhiều sản phẩm một lần: tự cộng kho, ghi công nợ nhà cung cấp và sổ quỹ." />
      <Notice error={error} ok={ok} />

      {canEdit && (
        <div className="mb-6">
          {goods.length === 0 ? (
            <p className="card text-sm text-slate-500">Chưa có hàng hoá nào để nhập. Hãy thêm sản phẩm loại "Hàng hoá" trước.</p>
          ) : (
            <PurchaseForm products={goods} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} action={createPurchase} />
          )}
        </div>
      )}

      <Table head={["Mã phiếu", "Nhà cung cấp", "Chi nhánh", "Tổng tiền", "Đã trả", "Còn nợ", "Thời gian"]}>
        {purchases.map((p) => (
          <tr key={p.id}>
            <td className="td font-medium">{p.code}{p.note && <div className="text-xs font-normal text-slate-500">{p.note}</div>}</td>
            <td className="td">{p.supplier}</td>
            <td className="td">{p.branch}</td>
            <td className="td">{vnd(p.total)}</td>
            <td className="td">{vnd(p.paid)}</td>
            <td className="td">{p.total > p.paid ? <Badge tone="amber">{vnd(p.total - p.paid)}</Badge> : "—"}</td>
            <td className="td text-slate-500">{new Date(p.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td>
          </tr>
        ))}
        {purchases.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={7}>Chưa có phiếu nhập nào.</td></tr>
        )}
      </Table>
    </>
  );
}
