/**
 * Đọc / ghi file Excel (.xlsx) cho nhập xuất hàng hoá và kho. Chỉ chạy ở server.
 * exceljs là CommonJS: tuỳ môi trường, lớp nằm ở `default` hoặc ở chính module.
 */
export async function loadExcel() {
  const mod = await import("exceljs");
  return (mod as unknown as { default?: typeof mod }).default ?? mod;
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

/** Bỏ dấu, chữ thường, chỉ giữ chữ + số: "Mã (SKU) *" -> "masku". */
export function normHeader(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: unknown; result?: unknown; error?: unknown };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("").trim();
    if (o.result !== undefined) return cellText(o.result);
    if (o.text !== undefined) return cellText(o.text);
    return "";
  }
  return String(v).trim();
}

/** null = ô trống, undefined = không phải số hợp lệ. Hiểu "1.200.000", "1,200,000", "1200000đ". */
export function intCell(v: unknown): number | null | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : undefined;
  const t = cellText(v);
  if (t === "") return null;
  const cleaned = t.replace(/[\sđ₫]|vnd/gi, "");
  if (/^-?\d+[.,]\d{1,2}$/.test(cleaned)) return Math.round(parseFloat(cleaned.replace(",", ".")));
  if (!/^-?[\d.,]+$/.test(cleaned)) return undefined;
  const n = Number(cleaned.replace(/[.,]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

/** Trả YYYY-MM-DD. null = trống, undefined = sai định dạng. Hiểu dd/mm/yyyy, yyyy-mm-dd, ngày của Excel. */
export function dateCell(v: unknown): string | null | undefined {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86_400_000));
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
  }
  const t = cellText(v);
  if (t === "") return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  let y: number, mo: number, d: number;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return undefined;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return undefined;
  return dt.toISOString().slice(0, 10);
}

export interface SheetRow {
  /** Số dòng trong file Excel (để báo lỗi) */
  n: number;
  cells: Record<string, unknown>;
}

/** Đọc trang tính đầu tiên; dòng 1 là tiêu đề, bỏ qua dòng trống hoàn toàn. */
export async function readSheet(file: File): Promise<{ rows: SheetRow[] } | { error: string }> {
  if (file.size === 0) return { error: "File trống." };
  if (file.size > MAX_IMPORT_BYTES) return { error: "File quá lớn (tối đa 5MB)." };
  if (!/\.xlsx$/i.test(file.name)) return { error: "Chỉ nhận file Excel .xlsx. Nếu là .xls hoặc .csv, hãy mở bằng Excel rồi Lưu thành .xlsx." };

  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    return { error: `Không đọc được file (${why.slice(0, 120)}). Hãy dùng đúng file .xlsx (có thể tải file mẫu).` };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { error: "File không có trang tính nào." };

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = normHeader(cellText(cell.value));
  });
  if (!headers.some(Boolean)) return { error: "Dòng 1 phải là tiêu đề cột (Mã, Tên, Giá bán...). Hãy dùng file mẫu." };

  const rows: SheetRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: Record<string, unknown> = {};
    let any = false;
    headers.forEach((h, col) => {
      if (!h) return;
      const v = row.getCell(col).value;
      if (cellText(v) !== "") any = true;
      cells[h] = v;
    });
    if (any) rows.push({ n: r, cells });
    if (rows.length > MAX_IMPORT_ROWS) return { error: `Tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần nhập. Hãy chia nhỏ file.` };
  }
  if (rows.length === 0) return { error: "File không có dòng dữ liệu nào (từ dòng 2)." };
  return { rows };
}

/** Lấy giá trị cột theo tiêu đề đã chuẩn hoá: khớp đúng hoặc bắt đầu bằng một trong các tiền tố. */
export function pick(cells: Record<string, unknown>, exact: string[], prefixes: string[] = []): unknown {
  for (const k of exact) if (k in cells) return cells[k];
  for (const key of Object.keys(cells)) if (prefixes.some((p) => key.startsWith(p))) return cells[key];
  return undefined;
}

export interface Col { header: string; key: string; width: number; money?: boolean }

/** Tạo file xlsx 1 hoặc nhiều trang, trả về byte để đưa vào Response. */
export async function buildXlsx(
  sheets: { name: string; columns: Col[]; rows: object[]; note?: string }[],
): Promise<Uint8Array> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "PiKa Store";
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    ws.columns = s.columns.map((c) => ({
      header: c.header, key: c.key, width: c.width, style: c.money ? { numFmt: "#,##0" } : {},
    }));
    ws.addRows(s.rows);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
