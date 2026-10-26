"use client";

import { Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { PRICE_OPS, ROUND_STEPS } from "@/lib/pricing";
import { vnd } from "@/lib/format";

export interface StockItem { id: string; sku: string; name: string; stock: number; minStock: number; cost: number }

const field = "rounded-xl border border-slate-200 px-3 py-2 text-sm";
type Act = (form: FormData) => void | Promise<void>;

export function StockTable({ items, canEdit, editAction, bulkAction }: {
  items: StockItem[]; canEdit: boolean; editAction: Act; bulkAction: Act;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [mode, setMode] = useState("minStock");
  const [op, setOp] = useState("inc_pct");

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => i.name.toLowerCase().includes(s) || i.sku.toLowerCase().includes(s)) : items;
  }, [items, q]);
  const allPicked = shown.length > 0 && shown.every((i) => picked.has(i.id));
  const cols = canEdit ? 7 : 5;

  function toggle(id: string) {
    setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setPicked((p) => {
      const n = new Set(p);
      if (allPicked) shown.forEach((i) => n.delete(i.id)); else shown.forEach((i) => n.add(i.id));
      return n;
    });
  }

  return (
    <div className="space-y-3">
      <input className={`${field} w-full sm:max-w-xs`} placeholder="Tìm tên hoặc mã..." value={q} onChange={(e) => setQ(e.target.value)} />

      {canEdit && picked.size > 0 && (
        <form action={bulkAction} className="card space-y-3 border-brand-300">
          <p className="text-sm font-medium">Sửa hàng loạt · đã chọn {picked.size} mặt hàng</p>
          {[...picked].map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">Thao tác
              <select name="mode" className={`${field} mt-1 block`} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="minStock">Đặt tồn tối thiểu</option>
                <option value="setQty">Kiểm kho: đặt số lượng tồn</option>
                <option value="cost">Sửa giá vốn</option>
              </select>
            </label>
            {mode === "cost" && (
              <label className="text-sm">Cách sửa
                <select name="op" className={`${field} mt-1 block`} value={op} onChange={(e) => setOp(e.target.value)}>
                  {PRICE_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            )}
            <label className="text-sm">Giá trị{mode === "cost" ? ` (${PRICE_OPS.find((o) => o.value === op)?.unit})` : ""}
              <input name="value" inputMode="decimal" required className={`${field} mt-1 block w-32`} />
            </label>
            {mode === "cost" && (
              <label className="text-sm">Làm tròn
                <select name="round" className={`${field} mt-1 block`} defaultValue={0}>
                  {ROUND_STEPS.map((r) => <option key={r} value={r}>{r === 0 ? "Không" : vnd(r)}</option>)}
                </select>
              </label>
            )}
            <button className="btn-primary">Áp dụng</button>
            <button type="button" className="btn-secondary" onClick={() => setPicked(new Set())}>Bỏ chọn</button>
          </div>
          {mode === "setQty" && <p className="text-xs text-amber-700">Tồn của tất cả mặt hàng đã chọn sẽ được đặt đúng bằng số này (ở chi nhánh chính).</p>}
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {canEdit && <th className="w-10 px-3 py-2"><input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="Chọn tất cả" /></th>}
              <th className="th">Mã</th><th className="th">Sản phẩm</th><th className="th">Tồn</th>
              <th className="th">Tối thiểu</th><th className="th">Trạng thái</th>
              {canEdit && <th className="th" />}
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const low = p.stock <= p.minStock;
              return (
                <Fragment key={p.id}>
                  <tr className="border-t border-slate-100">
                    {canEdit && <td className="px-3 py-2"><input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} /></td>}
                    <td className="td text-slate-500">{p.sku}</td>
                    <td className="td font-medium">{p.name}</td>
                    <td className="td">{p.stock}</td>
                    <td className="td">{p.minStock}</td>
                    <td className="td"><Badge tone={low ? "red" : "green"}>{low ? "Sắp hết" : "Đủ hàng"}</Badge></td>
                    {canEdit && (
                      <td className="td">
                        <button type="button" className="text-brand-700 hover:underline" onClick={() => setEditing(editing === p.id ? null : p.id)}>
                          {editing === p.id ? "Đóng" : "Sửa"}
                        </button>
                      </td>
                    )}
                  </tr>
                  {canEdit && editing === p.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={cols} className="px-3 py-3">
                        <form action={editAction} className="flex flex-wrap items-end gap-3">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="oldQty" value={p.stock} />
                          <label className="text-sm">Tồn thực tế<input name="qty" inputMode="numeric" defaultValue={p.stock} className={`${field} mt-1 block w-28`} /></label>
                          <label className="text-sm">Tồn tối thiểu<input name="minStock" inputMode="numeric" defaultValue={p.minStock} className={`${field} mt-1 block w-28`} /></label>
                          <label className="text-sm">Giá vốn (đ)<input name="cost" inputMode="numeric" defaultValue={p.cost} className={`${field} mt-1 block w-32`} /></label>
                          <label className="text-sm">Ghi chú<input name="note" className={`${field} mt-1 block w-48`} placeholder="Lý do sửa" /></label>
                          <button className="btn-primary">Lưu</button>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {shown.length === 0 && <tr><td className="td text-slate-500" colSpan={cols}>Không có hàng hoá phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
