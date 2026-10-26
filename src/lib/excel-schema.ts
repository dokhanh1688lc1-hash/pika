import type { Col } from "@/lib/excel";

export const KIND_LABEL: Record<string, string> = { goods: "Hàng hoá", service: "Dịch vụ", package: "Liệu trình" };

export const PRODUCT_COLUMNS: Col[] = [
  { header: "Mã (SKU)", key: "sku", width: 16 },
  { header: "Tên", key: "name", width: 36 },
  { header: "Loại", key: "kind", width: 14 },
  { header: "Nhóm hàng", key: "category", width: 20 },
  { header: "Giá bán", key: "price", width: 14, money: true },
  { header: "Giá vốn", key: "cost", width: 14, money: true },
  { header: "Tồn tối thiểu", key: "minStock", width: 14 },
  { header: "Số buổi", key: "sessions", width: 10 },
  { header: "Tồn đầu kỳ", key: "openingStock", width: 12 },
];

export const STOCK_COLUMNS: Col[] = [
  { header: "Mã SP", key: "sku", width: 16 },
  { header: "Số lượng", key: "qty", width: 12 },
  { header: "Giá nhập", key: "unitCost", width: 14, money: true },
  { header: "Hạn sử dụng", key: "expiry", width: 14 },
  { header: "Số lô", key: "batch", width: 14 },
  { header: "Ghi chú", key: "note", width: 28 },
];
