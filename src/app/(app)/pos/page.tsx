import { PosTerminal } from "@/components/PosTerminal";
import { PageHeader } from "@/components/ui";
import { getStoreInfo, listCustomers, listProducts, listStaff } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";

export default async function PosPage() {
  const [products, customers, staff, store] = await Promise.all([
    listProducts(), listCustomers(), listStaff(), getStoreInfo(),
  ]);
  return (
    <>
      <PageHeader title="Bán hàng (POS)" subtitle="Chọn sản phẩm, khách hàng và thanh toán. Kho, công nợ, điểm thưởng tự cập nhật." />
      <PosTerminal
        demo={!isSupabaseConfigured()}
        bank={store.bank}
        products={products.map((p) => ({
          id: p.id, sku: p.sku, name: p.name, kind: p.kind, price: p.price, stock: p.stock, imageUrl: p.imageUrl ?? null,
        }))}
        customers={customers.map((c) => ({ id: c.id, name: `${c.name}${c.phone ? ` · ${c.phone}` : ""}` }))}
        staff={staff.map((s) => ({ id: s.id, name: s.name }))}
      />
    </>
  );
}
