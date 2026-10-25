import { PageHeader, Table } from "@/components/ui";
import { listStaff } from "@/lib/data/repo";
import { vnd } from "@/lib/format";

export default async function StaffPage() {
  const staff = await listStaff();
  return (
    <>
      <PageHeader title="Nhân viên" subtitle="Hiệu suất và hoa hồng theo tháng" />
      <Table head={["Nhân viên", "Vai trò", "Doanh thu tháng", "% hoa hồng", "Hoa hồng tạm tính"]}>
        {staff.map((s) => (
          <tr key={s.id}>
            <td className="td font-medium">{s.name}</td>
            <td className="td">{s.role}</td>
            <td className="td">{vnd(s.monthRevenue)}</td>
            <td className="td">{(s.commissionRate * 100).toFixed(0)}%</td>
            <td className="td">{vnd(s.monthRevenue * s.commissionRate)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
