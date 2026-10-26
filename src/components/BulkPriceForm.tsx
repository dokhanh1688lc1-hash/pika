"use client";

import { useMemo, useState } from "react";
import { applyPriceRule, PRICE_OPS, ROUND_STEPS, type PriceField, type PriceOp } from "@/lib/pricing";
import { vnd } from "@/lib/format";

export interface BulkItem { id: string; sku: string; name: string; kind: string; category: string; price: number; cost: number }

const KIND: Record<string, string> = { goods: "Hàng hoá", service: "Dịch vụ", package: "Liệu trình" };
const field = "rounded-xl border border-slate-200 px-3 py-2 text-sm";

export function BulkPriceForm({
  items, action,
}: {
  items: BulkItem[];
  action: (form: FormData) => void | Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [cat, setCat] = useState("");
  const [fld, setFld] = useState<PriceField>("price");
  const [op, setOp] = useState<PriceOp>("inc_pct");
  const [value, setValue] = useState("10");
  const [round, setRound] = useState(1000);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const cats = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) =>
      (!kind || i.kind === kind) && (!cat || i.category === cat) &&
      (!s || i.name.toLowerCase().includes(s) || i.sku.toLowerCase().includes(s)));
  }, [items, q, kind, cat]);

  const num = Number(value.replace(",", "."));
  const valid = value.trim() !== "" && Number.isFinite(num) && num >= 0 && !(op === "dec_pct" && num > 100);
  const rule = { field: fld, op, value: num, round };
  const allShownPicked = shown.length > 0 && shown.every((i) => picked.has(i.id));

  function toggleAll() {
    setPicked((prev) => {
      const next = new Set(prev);
      if (allShownPicked) shown.forEach((i) => next.delete(i.id)); else shown.forEach((i) => next.add(i.id));
      return next;
    });
  }
  function toggle(id: string) {
    setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  return (
    <form action={action} className="space-y-4">
      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Sửa giá
          <select className={`${field} mt-1 w-full`} name="field" value={fld} onChange={(e) => setFld(e.target.value as PriceField)}>
            <option value="price">Giá bán</option><option value="cost">Giá vốn</option>
          </select>
        </label>
        <label className="text-sm">Cách sửa
          <select className={`${field} mt-1 w-full`} name="op" value={op} onChange={(e) => setOp(e.target.value as PriceOp)}>
            {PRICE_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Giá trị ({PRICE_OPS.find((o) => o.value === op)?.unit})
          <input className={`${field} mt-1 w-full`} name="value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="text-sm">Làm tròn
          <select className={`${field} mt-1 w-full`} name="round" value={round} onChange={(e) => setRound(Number(e.target.value))}>
            {ROUND_STEPS.map((r) => <option key={r} value={r}>{r === 0 ? "Không làm tròn" : `Tròn ${vnd(r)}`}</option>)}
          </select>
        </label>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          <input className={`${field} min-w-0 flex-1`} placeholder="Tìm tên hoặc mã..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Mọi loại</option>
            {Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className={field} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Mọi nhóm</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="w-10 px-3 py-2"><input type="checkbox" checked={allShownPicked} onChange={toggleAll} aria-label="Chọn tất cả" /></th>
                <th className="th">Sản phẩm</th>
                <th className="th text-right">{fld === "price" ? "Giá bán" : "Giá vốn"} hiện tại</th>
                <th className="th text-right">Sau khi sửa</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const old = fld === "price" ? i.price : i.cost;
                const on = picked.has(i.id);
                const next = valid ? applyPriceRule(old, rule) : old;
                return (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="px-3 py-2"><input type="checkbox" checked={on} onChange={() => toggle(i.id)} /></td>
                    <td className="px-3 py-2"><span className="text-slate-500">{i.sku}</span> · {i.name}</td>
                    <td className="px-3 py-2 text-right">{vnd(old)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${on && valid && next !== old ? (next > old ? "text-green-700" : "text-red-700") : "text-slate-400"}`}>
                      {on && valid ? vnd(next) : "—"}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Không có sản phẩm phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>

        {[...picked].map((id) => <input key={id} type="hidden" name="ids" value={id} />)}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-slate-600">Đã chọn {picked.size} sản phẩm</span>
          <button className="btn-primary disabled:opacity-50" disabled={picked.size === 0 || !valid}>Áp dụng giá mới</button>
        </div>
      </div>
    </form>
  );
}
