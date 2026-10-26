/**
 * Đọc .xlsx tối giản bằng jszip (không dùng exceljs, vì exceljs hay lỗi với file do công cụ khác tạo).
 * Trả về trang tính đầu tiên dạng mảng dòng; chỉ số cột bắt đầu từ 1. Số trả về dạng number, còn lại là chuỗi.
 */

export function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Ghép các đoạn <t> trong một khối (bỏ phiên âm <rPh>). */
function textOf(block: string): string {
  const clean = block.replace(/<rPh[\s\S]*?<\/rPh>/g, "");
  let out = "";
  for (const m of clean.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1];
  return decodeXml(out);
}

export function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si\s*\/>/g)) out.push(m[1] ? textOf(m[1]) : "");
  return out;
}

export function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return m ? decodeXml(m[1]) : undefined;
}

export type RawRow = { n: number; cells: Map<number, string | number> };

export function parseSheet(xml: string, shared: string[]): RawRow[] {
  const rows: RawRow[] = [];
  for (const rm of xml.matchAll(/<row(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNo = Number(attr(rm[1] ?? "", "r")) || rows.length + 1;
    const cells = new Map<number, string | number>();
    let auto = 0;
    for (const cm of (rm[2] ?? "").matchAll(/<c(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = cm[1] ?? "";
      const ref = attr(tag, "r");
      const col = ref ? colIndex(ref.replace(/\d+/g, "")) : ++auto;
      auto = col;
      const body = cm[2] ?? "";
      const type = attr(tag, "t");
      let val: string | number | undefined;
      if (type === "inlineStr") {
        val = textOf(body);
      } else {
        const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body);
        if (!v) continue;
        const raw = decodeXml(v[1]);
        if (type === "s") val = shared[Number(raw)] ?? "";
        else if (type === "str" || type === "e") val = raw;
        else if (type === "b") val = raw === "1" ? "TRUE" : "FALSE";
        else if (type === "d") val = raw.slice(0, 10);
        else { const num = Number(raw); val = raw.trim() !== "" && Number.isFinite(num) ? num : raw; }
      }
      if (val !== undefined && val !== "") cells.set(col, val);
    }
    rows.push({ n: rowNo, cells });
  }
  return rows;
}

export async function readFirstSheet(buf: Buffer): Promise<RawRow[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const text = async (path: string) => (await zip.file(path)?.async("string")) ?? null;

  const wbXml = await text("xl/workbook.xml");
  if (wbXml === null) throw new Error("không phải file xlsx (thiếu xl/workbook.xml)");
  let target = "worksheets/sheet1.xml";
  const first = /<sheet\b[^>]*>/.exec(wbXml);
  const rid = first ? attr(first[0], "r:id") : undefined;
  const rels = await text("xl/_rels/workbook.xml.rels");
  if (rid && rels) {
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      if (attr(m[0], "Id") === rid) { target = attr(m[0], "Target") ?? target; break; }
    }
  }
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  let sheetXml = await text(path);
  if (sheetXml === null) {
    const any = Object.keys(zip.files).find((f) => /^xl\/worksheets\/[^/]+\.xml$/.test(f));
    sheetXml = any ? await text(any) : null;
  }
  if (sheetXml === null) throw new Error("không tìm thấy trang tính");
  const sst = await text("xl/sharedStrings.xml");
  return parseSheet(sheetXml, sst ? parseSharedStrings(sst) : []);
}
