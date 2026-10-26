/** Quy tắc sửa giá hàng loạt. Dùng chung cho bản xem trước (trình duyệt) và bản lưu (server). */
export type PriceOp = "set" | "inc_pct" | "dec_pct" | "inc_amt" | "dec_amt";
export type PriceField = "price" | "cost";

export interface PriceRule {
  field: PriceField;
  op: PriceOp;
  value: number;
  /** Làm tròn tới bội số này (0 = không làm tròn), vd 1000 -> 125.400 thành 125.000 */
  round: number;
}

export const PRICE_OPS: { value: PriceOp; label: string; unit: string }[] = [
  { value: "inc_pct", label: "Tăng theo %", unit: "%" },
  { value: "dec_pct", label: "Giảm theo %", unit: "%" },
  { value: "inc_amt", label: "Tăng một số tiền", unit: "đ" },
  { value: "dec_amt", label: "Giảm một số tiền", unit: "đ" },
  { value: "set", label: "Đặt về đúng giá", unit: "đ" },
];

export const ROUND_STEPS = [0, 100, 500, 1000, 5000, 10000];

export function applyPriceRule(current: number, rule: PriceRule): number {
  let next: number;
  switch (rule.op) {
    case "set": next = rule.value; break;
    case "inc_pct": next = current * (1 + rule.value / 100); break;
    case "dec_pct": next = current * (1 - rule.value / 100); break;
    case "inc_amt": next = current + rule.value; break;
    case "dec_amt": next = current - rule.value; break;
  }
  if (rule.round > 0) next = Math.round(next / rule.round) * rule.round;
  return Math.max(0, Math.round(next));
}

/** Trả về thông báo lỗi nếu quy tắc không hợp lệ. */
export function validateRule(rule: PriceRule): string | null {
  if (!["price", "cost"].includes(rule.field)) return "Chọn giá cần sửa.";
  if (!PRICE_OPS.some((o) => o.value === rule.op)) return "Chọn cách sửa giá.";
  if (!Number.isFinite(rule.value) || rule.value < 0) return "Giá trị phải là số không âm.";
  if (rule.op === "dec_pct" && rule.value > 100) return "Không thể giảm quá 100%.";
  if (rule.op.endsWith("_pct") && rule.value > 1000) return "Phần trăm quá lớn.";
  if (!ROUND_STEPS.includes(rule.round)) return "Mức làm tròn không hợp lệ.";
  return null;
}
