"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { checkout, type CheckoutResult } from "@/app/(app)/pos/actions";
import { vnd } from "@/lib/format";

export interface PosProduct {
  id: string;
  sku: string;
  name: string;
  kind: "goods" | "service" | "package";
  price: number;
  stock: number | null;
  imageUrl?: string | null;
}
export interface PosPerson {
  id: string;
  name: string;
}

const METHODS = [
  { value: "cash", label: "Tiền mặt" },
  { value: "transfer", label: "Chuyển khoản" },
  { value: "card", label: "Thẻ" },
  { value: "ewallet", label: "Ví điện tử" },
] as const;

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400";

const toNumber = (s: string) => {
  const n = Number(s.replace(/[.,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

export function PosTerminal({
  products, customers, staff, demo,
}: {
  products: PosProduct[];
  customers: PosPerson[];
  staff: PosPerson[];
  demo: boolean;
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("cash");
  const [paidText, setPaidText] = useState("");
  const [discountText, setDiscountText] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, query]);

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: byId.get(id), qty }))
    .filter((l): l is { product: PosProduct; qty: number } => Boolean(l.product));
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  const discount = Math.min(toNumber(discountText), subtotal);
  const total = subtotal - discount;
  const paid = paidText === "" ? total : toNumber(paidText);
  const change = method === "cash" ? Math.max(paid - total, 0) : 0;
  const owing = Math.max(total - paid, 0);

  function add(p: PosProduct) {
    setResult(null);
    setCart((c) => {
      const next = (c[p.id] ?? 0) + 1;
      if (p.kind === "goods" && p.stock !== null && next > p.stock) return c; // không vượt tồn kho
      return { ...c, [p.id]: next };
    });
  }
  function change1(id: string, delta: number) {
    setCart((c) => {
      const p = byId.get(id);
      const next = (c[id] ?? 0) + delta;
      if (next <= 0) {
        const { [id]: _removed, ...rest } = c;
        return rest;
      }
      if (p && p.kind === "goods" && p.stock !== null && next > p.stock) return c;
      return { ...c, [id]: next };
    });
  }
  function remove(id: string) {
    setCart((c) => {
      const { [id]: _removed, ...rest } = c;
      return rest;
    });
  }

  function submit() {
    if (lines.length === 0) return;
    startTransition(async () => {
      const res = await checkout({
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty, staffId: staffId || null })),
        customerId: customerId || null,
        method,
        paid: Math.min(paid, total + change),
        discount,
        note: note.trim(),
      });
      setResult(res);
      if (res.ok) {
        setCart({});
        setPaidText("");
        setDiscountText("");
        setNote("");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên hoặc mã…"
          className={`${field} mb-4`}
        />
        <div className="grid auto-rows-min gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => {
            const out = p.kind === "goods" && (p.stock ?? 0) <= 0;
            return (
              <button
                key={p.id}
                type="button"
                disabled={out}
                onClick={() => add(p)}
                className="card text-left transition hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" loading="lazy" className="mb-2 aspect-[4/3] w-full rounded-lg object-cover" />
                )}
                <p className="text-xs text-slate-400">{p.sku}</p>
                <p className="mt-1 font-medium">{p.name}</p>
                <p className="mt-2 text-brand-700">{vnd(p.price)}</p>
                {p.kind === "goods" && (
                  <p className={`mt-1 text-xs ${out ? "text-rose-600" : "text-slate-500"}`}>
                    {out ? "Hết hàng" : `Còn ${p.stock}`}
                  </p>
                )}
              </button>
            );
          })}
          {shown.length === 0 && <p className="text-sm text-slate-500">Không có sản phẩm phù hợp.</p>}
        </div>
      </section>

      <aside className="card h-fit space-y-4">
        <h2 className="font-medium">Đơn hàng hiện tại</h2>

        {result?.ok === false && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{result.error}</p>
        )}
        {result?.ok && (
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <p className="font-medium">Đã tạo đơn {result.code}</p>
            <p>Tổng {vnd(result.total)} · đã thu {vnd(result.paid)}
              {result.status === "partial" ? " (còn nợ)" : ""}</p>
            {result.points > 0 && <p>Khách được cộng {result.points} điểm</p>}
          </div>
        )}

        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">Chọn sản phẩm bên trái để thêm vào đơn.</p>
        ) : (
          <ul className="space-y-3">
            {lines.map(({ product, qty }) => (
              <li key={product.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{product.name}</p>
                  <p className="text-slate-500">{vnd(product.price)} × {qty}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => change1(product.id, -1)} className="rounded-lg border p-1" aria-label="Giảm">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center">{qty}</span>
                  <button type="button" onClick={() => change1(product.id, 1)} className="rounded-lg border p-1" aria-label="Tăng">
                    <Plus size={14} />
                  </button>
                  <button type="button" onClick={() => remove(product.id)} className="rounded-lg p-1 text-rose-600" aria-label="Xoá">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={field}>
          <option value="">Khách lẻ (không tích điểm)</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={field}>
          <option value="">Nhân viên thực hiện (tính hoa hồng)</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <input value={discountText} onChange={(e) => setDiscountText(e.target.value)}
            inputMode="numeric" placeholder="Giảm giá (đ)" className={field} />
          <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={field}>
            {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <input value={paidText} onChange={(e) => setPaidText(e.target.value)}
          inputMode="numeric" placeholder={`Khách đưa (mặc định ${vnd(total)})`} className={field} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú" className={field} />

        <dl className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between"><dt>Tạm tính</dt><dd>{vnd(subtotal)}</dd></div>
          {discount > 0 && <div className="flex justify-between"><dt>Giảm giá</dt><dd>−{vnd(discount)}</dd></div>}
          <div className="flex justify-between text-base font-semibold"><dt>Tổng cộng</dt><dd>{vnd(total)}</dd></div>
          {change > 0 && <div className="flex justify-between text-slate-600"><dt>Tiền thối</dt><dd>{vnd(change)}</dd></div>}
          {owing > 0 && <div className="flex justify-between text-amber-700"><dt>Còn nợ</dt><dd>{vnd(owing)}</dd></div>}
        </dl>

        <button
          type="button"
          onClick={submit}
          disabled={pending || lines.length === 0 || demo}
          className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Đang xử lý…" : "Thanh toán"}
        </button>
        {demo && <p className="text-xs text-slate-500">Chế độ demo: kết nối Supabase để tạo đơn thật.</p>}
      </aside>
    </div>
  );
}
