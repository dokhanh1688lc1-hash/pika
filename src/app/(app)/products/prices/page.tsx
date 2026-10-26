import Link from "next/link";
import { BulkPriceForm } from "@/components/BulkPriceForm";
import { Notice, PageHeader } from "@/components/ui";
import { listProducts } from "@/lib/data/repo";
import { requireMember } from "@/lib/guard";
import { applyBulkPrice } from "./actions";

export default async function BulkPricePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  await requireMember("products.manage", "/products");
  const items = (await listProducts()).map((p) => ({
    id: p.id, sku: p.sku, name: p.name, kind: p.kind, category: p.category, price: p.price, cost: p.cost,
  }));
  return (
    <>
      <PageHeader title="Sửa giá hàng loạt" subtitle="Chọn sản phẩm, chọn cách tăng/giảm giá, xem trước rồi áp dụng" />
      <Notice error={error} ok={ok} />
      <div className="mb-4"><Link href="/products" className="btn-secondary">← Quay lại</Link></div>
      <BulkPriceForm items={items} action={applyBulkPrice} />
    </>
  );
}
