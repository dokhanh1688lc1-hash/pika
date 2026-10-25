/** Đọc số nguyên từ ô nhập: chấp nhận "1.500.000", "1,500,000", "1500000". */
export function toInt(value: FormDataEntryValue | null | undefined, fallback = 0): number {
  const cleaned = String(value ?? "").replace(/[.,\s]/g, "");
  if (!/^-?\d+$/.test(cleaned)) return fallback;
  return Number(cleaned);
}

export function toText(value: FormDataEntryValue | null | undefined): string {
  return String(value ?? "").trim();
}
