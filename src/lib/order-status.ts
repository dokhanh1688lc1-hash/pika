export const ORDER_STATUS = {
  draft: ["Nháp", "slate"],
  paid: ["Đã thanh toán", "green"],
  partial: ["Còn nợ", "amber"],
  refunded: ["Hoàn tiền", "blue"],
  cancelled: ["Đã huỷ", "red"],
} as const;

export const PAY_METHOD: Record<string, string> = {
  cash: "Tiền mặt", card: "Thẻ", transfer: "Chuyển khoản",
  ewallet: "Ví điện tử", points: "Điểm", package: "Liệu trình",
};
