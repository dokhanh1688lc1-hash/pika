import { Badge, PageHeader, Table } from "@/components/ui";
import { listCustomers } from "@/lib/data/repo";
import { num, vnd } from "@/lib/format";

export default async function CustomersPage() {
  const customers = await listCustomers();
  return (
    <>
      <PageHeader title="Khách hàng" subtitle="Hồ sơ khách hàng và chương trình tích điểm" />
      <Table head={["Khách hàng", "Điện thoại", "Hạng", "Điểm", "Tổng chi tiêu", "Lần cuối"]}>
        {customers.map((c) => (
          <tr key={c.id}>
            <td className="td font-medium">{c.name}</td>
            <td className="td">{c.phone}</td>
            <td className="td"><Badge tone="violet">{c.tier}</Badge></td>
            <td className="td">{num(c.points)}</td>
            <td className="td">{vnd(c.totalSpent)}</td>
            <td className="td text-slate-500">{c.lastVisit}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
