import { Badge, PageHeader, Table } from "@/components/ui";
import { listProducts } from "@/lib/data/repo";
import { vnd } from "@/lib/format";

const KIND = { goods: "Hàng hoá", service: "Dịch vụ", package: "Liệu trình" } as const;

export default async function ProductsPage() {
  const products = await listProducts();
  return (
    <>
      <PageHeader title="Hàng hoá & dịch vụ" subtitle="Danh mục sản phẩm, dịch vụ và liệu trình" />
      <Table head={["Mã", "Tên", "Loại", "Nhóm", "Giá bán", "Giá vốn", "Tồn"]}>
        {products.map((p) => (
          <tr key={p.id}>
            <td className="td text-slate-500">{p.sku}</td>
            <td className="td font-medium">{p.name}</td>
            <td className="td"><Badge tone="violet">{KIND[p.kind]}</Badge></td>
            <td className="td">{p.category}</td>
            <td className="td">{vnd(p.price)}</td>
            <td className="td">{p.cost ? vnd(p.cost) : "—"}</td>
            <td className="td">{p.stock ?? "—"}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
