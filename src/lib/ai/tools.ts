import type Anthropic from "@anthropic-ai/sdk";
import {
  dashboardStats, findCustomer, listExpiring, listTodayAppointments, lowStockProducts, searchProducts,
} from "@/lib/data/repo";

/**
 * Công cụ AI Agent được phép gọi. Chỉ ĐỌC dữ liệu ở giai đoạn nền tảng;
 * mọi thao tác ghi (tạo đơn, huỷ đơn...) phải qua bước xác nhận của người dùng (xem docs/ARCHITECTURE.md).
 */
export const agentTools: Anthropic.Tool[] = [
  {
    name: "get_dashboard_stats",
    description: "Doanh thu hôm nay, số đơn, khách mới, số sản phẩm sắp hết hàng và doanh thu 7 ngày gần nhất.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_products",
    description: "Tìm sản phẩm/dịch vụ theo tên hoặc mã SKU, trả về giá và tồn kho.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Tên hoặc SKU" } },
      required: ["query"],
    },
  },
  {
    name: "get_low_stock",
    description: "Danh sách sản phẩm có tồn kho dưới hoặc bằng mức tối thiểu.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "find_customer",
    description: "Tìm khách hàng theo tên hoặc số điện thoại, trả về hạng thành viên, điểm và tổng chi tiêu.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "get_expiring_products",
    description: "Các lô hàng đã hết hạn hoặc sắp hết hạn sử dụng (số ngày mặc định theo cấu hình cửa hàng, thường là 30), kèm số lượng, hạn dùng và số ngày còn lại (âm = đã quá hạn).",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Số ngày tới cần xem (tuỳ chọn)" } },
    },
  },
  {
    name: "get_today_appointments",
    description: "Lịch hẹn của hôm nay.",
    input_schema: { type: "object", properties: {} },
  },
];

export async function runTool(
  name: string,
  input: Record<string, unknown>,
  storeId?: string,
): Promise<unknown> {
  switch (name) {
    case "get_dashboard_stats":
      return dashboardStats(storeId);
    case "search_products":
      return searchProducts(String(input.query ?? ""), storeId);
    case "get_low_stock":
      return lowStockProducts(storeId);
    case "find_customer":
      return findCustomer(String(input.query ?? ""), storeId);
    case "get_expiring_products": {
      const d = Number(input.days);
      return Number.isFinite(d) && d > 0 ? listExpiring(Math.min(d, 365), storeId) : listExpiring(undefined, storeId);
    }
    case "get_today_appointments":
      return listTodayAppointments(storeId);
    default:
      return { error: `Công cụ không tồn tại: ${name}` };
  }
}
