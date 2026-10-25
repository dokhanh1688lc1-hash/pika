"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { vnd } from "@/lib/format";

export interface PurchaseProduct { id: string; sku: string; name: string; cost: number }
export interface PurchaseSupplier { id: string; name: string }

interface Line { productId: string; quantity: string; unitCost: string; expiry: string; batchCode: string }

const blank = (): Line => ({ productId: "", quantity: "1", unitCost: "", expiry: "", batchCode: "" });
const field = "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm";

export function PurchaseForm({
  products, suppliers, action,
}: {
  products: PurchaseProduct[];
  suppliers: PurchaseSupplier[];
  action: (form: FormData) => void | Promise<void>;
}) {
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [supplier, setSupplier] = useState("");
  const [paid, setPaid] = useState("");

  const total = useMemo(
    () => lines.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0),
    [lines],
  );
  const set = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const pick = (i: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    set(i, { productId, unitCost: p && p.cost > 0 ? String(p.cost) : lines[i].unitCost });
  };
  const payload = JSON.stringify(
    lines
      .filter((l) => l.productId)
      .map((l) => ({
        product_id: l.productId, quantity: Number(l.quantity) || 0, unit_cost: Number(l.unitCost) || 0,
        expiry: l.expiry, batch_code: l.batchCode,
      })),
  );
  const paidNum = paid === "" ? total : Number(paid) || 0;
  const debt = supplier ? Math.max(total - paidNum, 0) : 0;

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="items" value={payload} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Nhà cung cấp</span>
          <select name="supplierId" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={field}>
            <option value="">— Không chọn (mua lẻ, trả đủ) —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Ghi chú</span>
          <input name="note" className={field} />
        </label>
      </div>

      <div className="space-y-3">
        {lines.map((l, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-12">
            <select value={l.productId} onChange={(e) => pick(i, e.target.value)} className={`${field} sm:col-span-4`}>
              <option value="">— Chọn hàng hoá —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
            </select>
            <input value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} inputMode="numeric" placeholder="SL" className={`${field} sm:col-span-1`} />
            <input value={l.unitCost} onChange={(e) => set(i, { unitCost: e.target.value })} inputMode="numeric" placeholder="Giá nhập" className={`${field} sm:col-span-2`} />
            <input value={l.expiry} onChange={(e) => set(i, { expiry: e.target.value })} type="date" title="Hạn sử dụng (nếu có)" className={`${field} sm:col-span-2`} />
            <input value={l.batchCode} onChange={(e) => set(i, { batchCode: e.target.value })} placeholder="Số lô" className={`${field} sm:col-span-2`} />
            <button
              type="button"
              disabled={lines.length === 1}
              onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
              className="grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-30 sm:col-span-1"
              aria-label="Xoá dòng"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setLines((ls) => [...ls, blank()])} className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
          <Plus size={14} /> Thêm dòng
        </button>
      </div>

      <div className="grid items-end gap-4 sm:grid-cols-3">
        <div className="text-sm">
          <p className="text-slate-500">Tổng tiền hàng</p>
          <p className="text-xl font-semibold">{vnd(total)}</p>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Đã trả nhà cung cấp (đ)</span>
          <input name="paid" value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="numeric" placeholder={`Mặc định: trả đủ ${total}`} className={field} />
        </label>
        <div className="text-sm">
          <p className="text-slate-500">Ghi nợ nhà cung cấp</p>
          <p className={`text-xl font-semibold ${debt > 0 ? "text-amber-700" : ""}`}>{vnd(debt)}</p>
        </div>
      </div>
      <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        Tạo phiếu nhập & nhập kho
      </button>
    </form>
  );
}
