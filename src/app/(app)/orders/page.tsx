import { Badge, PageHeader, Table } from "@/components/ui";
import { listOrders } from "@/lib/data/repo";
import { vnd } from "@/lib/format";

const STATUS = {
  draft: ["Nháp", "slate"],
  paid: ["Đã thanh toán", "green"],
  partial: ["Còn nợ", "amber"],
  refunded: ["Hoàn tiền", "blue"],
  cancelled: ["Đã huỷ", "red"],
} as const;

export default async function OrdersPage() {
  const orders = await listOrders();
  return (
    <>
      <PageHeader title="Đơn hàng" subtitle="100 đơn gần nhất, tạo từ màn hình Bán hàng (POS)" />
      <Table head={["Mã đơn", "Khách hàng", "Tổng tiền", "Trạng thái", "Thời gian"]}>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="td font-medium">{o.code}</td>
            <td className="td">{o.customer}</td>
            <td className="td">{vnd(o.total)}</td>
            <td className="td"><Badge tone={STATUS[o.status][1]}>{STATUS[o.status][0]}</Badge></td>
            <td className="td text-slate-500">
              {new Date(o.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
            </td>
          </tr>
        ))}
        {orders.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={5}>Chưa có đơn hàng nào.</td></tr>
        )}
      </Table>
    </>
  );
}
