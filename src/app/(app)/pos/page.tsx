import { PageHeader } from "@/components/ui";
import { listProducts } from "@/lib/data/repo";
import { vnd } from "@/lib/format";

export default async function PosPage() {
  const products = await listProducts();
  return (
    <>
      <PageHeader title="Bán hàng (POS)" subtitle="Giao diện bán hàng — giỏ hàng, thanh toán, in hoá đơn sẽ hoàn thiện ở giai đoạn 2" />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="grid auto-rows-min gap-3 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-3">
          {products.map((p) => (
            <button key={p.id} className="card text-left transition hover:border-brand-300">
              <p className="text-xs text-slate-400">{p.sku}</p>
              <p className="mt-1 font-medium">{p.name}</p>
              <p className="mt-2 text-brand-700">{vnd(p.price)}</p>
            </button>
          ))}
        </section>
        <aside className="card h-fit">
          <h2 className="mb-3 font-medium">Đơn hàng hiện tại</h2>
          <p className="text-sm text-slate-500">Chưa có sản phẩm nào.</p>
          <div className="mt-6 flex justify-between border-t pt-4 font-medium">
            <span>Tổng cộng</span><span>{vnd(0)}</span>
          </div>
        </aside>
      </div>
    </>
  );
}
