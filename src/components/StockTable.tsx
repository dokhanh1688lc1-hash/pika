"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { compressImage } from "@/lib/image-client";
import { Badge } from "@/components/ui";
import { PRICE_OPS, ROUND_STEPS } from "@/lib/pricing";
import { vnd } from "@/lib/format";

export interface StockItem { id: string; sku: string; name: string; stock: number; minStock: number; cost: number; category: string }

const field = "rounded-xl border border-slate-200 px-3 py-2 text-sm";
type Act = (form: FormData) => void | Promise<void>;

/** Chọn ảnh, thu nhỏ trong trình duyệt rồi đặt lại vào ô file (giữ tên file nếu keepName). */
function useCompressedInput(keepName: boolean) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setCount(files.length);
    if (!files.length) return;
    setBusy(true);
    try {
      const dt = new DataTransfer();
      for (const f of files) {
        try {
          const out = await compressImage(f, 900, 0.82, keepName ? `${f.name.replace(/\.[^.]+$/, "")}.webp` : "image.webp");
          dt.items.add(out);
        } catch {
          dt.items.add(f); // không nén được: gửi file gốc, máy chủ sẽ kiểm tra lại
        }
      }
      if (ref.current) ref.current.files = dt.files;
    } finally {
      setBusy(false);
    }
  }
  return { ref, busy, count, onChange };
}

function BulkImagePanel({ pickedIds, cats, onClose, bulkImageAction, skuImagesAction }: {
  pickedIds: string[]; cats: string[]; onClose: () => void; bulkImageAction: Act; skuImagesAction: Act;
}) {
  const [target, setTarget] = useState<"selected" | "category">(pickedIds.length ? "selected" : "category");
  const one = useCompressedInput(false);
  const many = useCompressedInput(true);
  return (
    <div className="card space-y-5 border-brand-300">
      <div className="flex items-center justify-between">
        <p className="font-medium">Đổi ảnh hàng loạt</p>
        <button type="button" className="text-sm text-slate-500 hover:underline" onClick={onClose}>Đóng</button>
      </div>

      <form action={bulkImageAction} className="space-y-3">
        <p className="text-sm font-medium">1. Cùng một ảnh cho nhiều mặt hàng</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="target" value="selected" checked={target === "selected"} onChange={() => setTarget("selected")} />
            Các mục đã chọn ({pickedIds.length})
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="target" value="category" checked={target === "category"} onChange={() => setTarget("category")} />
            Cả một nhóm hàng
          </label>
        </div>
        {target === "selected" && pickedIds.map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
        {target === "category" && (
          <select name="category" required className={field} defaultValue="">
            <option value="" disabled>— Chọn nhóm hàng —</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <input ref={one.ref} type="file" name="image" accept="image/*" required onChange={one.onChange}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2" />
        <button className="btn-primary disabled:opacity-60" disabled={one.busy || (target === "selected" && pickedIds.length === 0)}>
          {one.busy ? "Đang xử lý ảnh…" : "Đổi ảnh"}
        </button>
        <p className="text-xs text-slate-500">Mỗi mặt hàng nhận một bản ảnh riêng; ảnh cũ của mặt hàng đó bị thay. Tối đa 100 mặt hàng mỗi lần.</p>
      </form>

      <form action={skuImagesAction} className="space-y-3 border-t border-slate-100 pt-4">
        <p className="text-sm font-medium">2. Nhiều ảnh, mỗi ảnh một mặt hàng</p>
        <p className="text-xs text-slate-500">Đặt tên file bằng mã sản phẩm, ví dụ <b>SP001.jpg</b>, <b>SP002.png</b>. Hệ thống tự ghép ảnh vào đúng mã. Tối đa 100 ảnh mỗi lần.</p>
        <input ref={many.ref} type="file" name="images" accept="image/*" multiple required onChange={many.onChange}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2" />
        <button className="btn-primary disabled:opacity-60" disabled={many.busy}>
          {many.busy ? "Đang xử lý ảnh…" : `Tải ${many.count || ""} ảnh lên`}
        </button>
      </form>
    </div>
  );
}

export function StockTable({ items, canEdit, editAction, bulkAction, multiAction, bulkImageAction, skuImagesAction }: {
  items: StockItem[]; canEdit: boolean; editAction: Act; bulkAction: Act; multiAction: Act;
  bulkImageAction: Act; skuImagesAction: Act;
}) {
  const [imgOpen, setImgOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [mode, setMode] = useState("minStock");
  const [op, setOp] = useState("inc_pct");
  const [cat, setCat] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [grid, setGrid] = useState(false);
  const cats = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!cat || i.category === cat) &&
        (!lowOnly || i.stock <= i.minStock) &&
        (!s || i.name.toLowerCase().includes(s) || i.sku.toLowerCase().includes(s)),
    );
  }, [items, q, cat, lowOnly]);
  const pickedItems = useMemo(() => items.filter((i) => picked.has(i.id)), [items, picked]);
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
      <div className="flex flex-wrap gap-2">
        <input className={`${field} min-w-0 flex-1 basis-48`} placeholder="Tìm tên hoặc mã..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={field} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Mọi nhóm</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" onClick={() => setLowOnly((v) => !v)}
          className={`rounded-xl px-3 py-2 text-sm ${lowOnly ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
          Sắp hết hàng
        </button>
        {canEdit && (
          <button type="button" onClick={() => setImgOpen((v) => !v)} className="btn-secondary">Đổi ảnh hàng loạt</button>
        )}
      </div>

      {canEdit && imgOpen && (
        <BulkImagePanel
          pickedIds={[...picked]} cats={cats} onClose={() => setImgOpen(false)}
          bulkImageAction={bulkImageAction} skuImagesAction={skuImagesAction}
        />
      )}

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
            <button type="button" className="btn-secondary" onClick={() => setGrid(true)}>Sửa từng mặt hàng đã chọn</button>
            <button type="button" className="btn-secondary" onClick={() => setPicked(new Set())}>Bỏ chọn</button>
          </div>
          {mode === "setQty" && <p className="text-xs text-amber-700">Tồn của tất cả mặt hàng đã chọn sẽ được đặt đúng bằng số này (ở chi nhánh chính).</p>}
        </form>
      )}

      {canEdit && grid && pickedItems.length > 0 && (
        <form action={multiAction} className="card space-y-3 border-brand-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Sửa {pickedItems.length} mặt hàng — mỗi dòng một giá trị</p>
            <button type="button" className="text-sm text-slate-500 hover:underline" onClick={() => setGrid(false)}>Đóng</button>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr><th className="th">Sản phẩm</th><th className="th">Tồn thực tế</th><th className="th">Tối thiểu</th><th className="th">Giá vốn (đ)</th></tr>
              </thead>
              <tbody>
                {pickedItems.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <input type="hidden" name="ids" value={p.id} />
                      <input type="hidden" name={`old_${p.id}`} value={p.stock} />
                      <span className="text-slate-500">{p.sku}</span> · {p.name}
                    </td>
                    <td className="px-2 py-1"><input name={`qty_${p.id}`} inputMode="numeric" defaultValue={p.stock} className={`${field} w-24`} /></td>
                    <td className="px-2 py-1"><input name={`min_${p.id}`} inputMode="numeric" defaultValue={p.minStock} className={`${field} w-24`} /></td>
                    <td className="px-2 py-1"><input name={`cost_${p.id}`} inputMode="numeric" defaultValue={p.cost} className={`${field} w-28`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-primary">Lưu tất cả</button>
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
