/** Khoảng ngày cho báo cáo, tính theo giờ Việt Nam. Ngày dạng YYYY-MM-DD. */
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const vnToday = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const isIsoDate = (s: string | undefined): s is string =>
  !!s && ISO.test(s) && !Number.isNaN(Date.parse(s));

export const RANGES = [
  { key: "today", label: "Hôm nay" },
  { key: "7d", label: "7 ngày" },
  { key: "month", label: "Tháng này" },
  { key: "lastmonth", label: "Tháng trước" },
] as const;

export interface Period { from: string; to: string; range: string }

export function resolvePeriod(sp: { range?: string; from?: string; to?: string }): Period {
  const today = vnToday();
  if (isIsoDate(sp.from) && isIsoDate(sp.to) && sp.from <= sp.to) {
    return { from: sp.from, to: sp.to, range: "custom" };
  }
  const monthStart = `${today.slice(0, 8)}01`;
  switch (sp.range) {
    case "today": return { from: today, to: today, range: "today" };
    case "7d": return { from: addDays(today, -6), to: today, range: "7d" };
    case "lastmonth": {
      const to = addDays(monthStart, -1);
      return { from: `${to.slice(0, 8)}01`, to, range: "lastmonth" };
    }
    default: return { from: monthStart, to: today, range: "month" };
  }
}
