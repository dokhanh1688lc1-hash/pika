import type { BatchRow } from "@/lib/data/types";

export type ExpiryLevel = "expired" | "critical" | "warning" | "ok";

export const EXPIRY_LABEL: Record<ExpiryLevel, string> = {
  expired: "Đã hết hạn",
  critical: "Còn ≤ 7 ngày",
  warning: "Còn ≤ 30 ngày",
  ok: "Còn hạn",
};

export const EXPIRY_TONE = {
  expired: "red",
  critical: "amber",
  warning: "blue",
  ok: "green",
} as const;

export function expiryLevel(daysLeft: number): ExpiryLevel {
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= 30) return "warning";
  return "ok";
}

/** "2026-11-18" -> "18/11/2026" */
export const fmtDate = (iso: string) => iso.split("-").reverse().join("/");

export function daysText(daysLeft: number): string {
  if (daysLeft < 0) return `quá hạn ${-daysLeft} ngày`;
  if (daysLeft === 0) return "hết hạn hôm nay";
  return `còn ${daysLeft} ngày`;
}

const line = (b: BatchRow) =>
  `• ${b.product}${b.batchCode ? ` (lô ${b.batchCode})` : ""}: ${b.quantity} — HSD ${fmtDate(b.expiryDate)}, ${daysText(b.daysLeft)}`;

/** Nội dung tin nhắn Telegram cảnh báo hạn sử dụng. */
export function formatExpiryMessage(rows: BatchRow[], windowDays: number): string {
  if (rows.length === 0) return `Không có lô hàng nào hết hạn trong ${windowDays} ngày tới.`;
  const expired = rows.filter((r) => r.daysLeft < 0);
  const soon = rows.filter((r) => r.daysLeft >= 0);
  const parts: string[] = [];
  if (expired.length) {
    parts.push(`ĐÃ HẾT HẠN (${expired.length} lô) — ngừng bán và huỷ:\n${expired.slice(0, 20).map(line).join("\n")}`);
  }
  if (soon.length) {
    parts.push(`SẮP HẾT HẠN trong ${windowDays} ngày (${soon.length} lô):\n${soon.slice(0, 25).map(line).join("\n")}`);
  }
  if (rows.length > 45) parts.push(`… và còn nhiều lô khác, xem đầy đủ trong web app (mục Hạn sử dụng).`);
  return parts.join("\n\n");
}
