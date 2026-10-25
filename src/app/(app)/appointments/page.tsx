import { Badge, PageHeader, Table } from "@/components/ui";
import { listTodayAppointments } from "@/lib/data/repo";

const STATUS = {
  booked: ["Đã đặt", "blue"],
  in_progress: ["Đang làm", "amber"],
  done: ["Hoàn thành", "green"],
  cancelled: ["Đã huỷ", "red"],
} as const;

export default async function AppointmentsPage() {
  const appts = await listTodayAppointments();
  return (
    <>
      <PageHeader title="Lịch hẹn" subtitle="Lịch hôm nay — lịch tuần/tháng và nhắc hẹn qua Telegram ở giai đoạn 2" />
      <Table head={["Giờ", "Khách hàng", "Dịch vụ", "Nhân viên", "Trạng thái"]}>
        {appts.map((a) => (
          <tr key={a.id}>
            <td className="td font-medium">{a.time}</td>
            <td className="td">{a.customer}</td>
            <td className="td">{a.service}</td>
            <td className="td">{a.staff}</td>
            <td className="td"><Badge tone={STATUS[a.status][1]}>{STATUS[a.status][0]}</Badge></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
