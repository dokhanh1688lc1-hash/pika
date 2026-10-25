import { Badge, PageHeader, Table } from "@/components/ui";
import { listProducts } from "@/lib/data/repo";

export default async function InventoryPage() {
  const items = (await listProducts()).filter((p) => p.stock !== null);
  return (
    <>
      <PageHeader title="Kho" subtitle="Tồn kho theo chi nhánh; nhập hàng, kiểm kho, chuyển kho sẽ bổ sung ở giai đoạn 2" />
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
      </Table>
    </>
  );
}
