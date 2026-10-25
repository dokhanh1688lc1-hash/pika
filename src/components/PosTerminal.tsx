"use client";

import { Minus, Plus, Printer, ShoppingCart, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { checkout, type CheckoutResult } from "@/app/(app)/pos/actions";
import { vnd } from "@/lib/format";
import { vietQrUrl, type BankInfo } from "@/lib/vietqr";

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
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-400 sm:py-2 sm:text-sm";

const KINDS = [
  { key: "all", label: "Tất cả" },
  { key: "goods", label: "Hàng hoá" },
  { key: "service", label: "Dịch vụ" },
  { key: "package", label: "Liệu trình" },
] as const;
const QUICK_CASH = [50_000, 100_000, 200_000, 500_000];

const toNumber = (s: string) => {
  const n = Number(s.replace(/[.,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

export function PosTerminal({
  products, customers, staff, demo, bank,
}: {
  products: PosProduct[];
  customers: PosPerson[];
  staff: PosPerson[];
  demo: boolean;
  bank: BankInfo | null;
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
  const [paidWith, setPaidWith] = useState<string>("cash");
  const [showDone, setShowDone] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("all");
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (kind === "all" || p.kind === kind) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    );
  }, [products, query, kind]);

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: byId.get(id), qty }))
    .filter((l): l is { product: PosProduct; qty: number } => Boolean(l.product));
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  const discount = Math.min(toNumber(discountText), subtotal);
  const total = subtotal - discount;
  const paid = paidText === "" ? total : toNumber(paidText);
  const change = method === "cash" ? Math.max(paid - total, 0) : 0;
  const owing = Math.max(total - paid, 0);
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);

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
        setPaidWith(method);
        setShowDone(true);
        setCartOpen(false);
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
        <div className="sticky top-12 z-20 -mx-4 mb-3 space-y-2 bg-slate-50 px-4 pb-2 pt-2 md:static md:mx-0 md:px-0 md:pt-0 lg:top-0">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc mã…"
            className={field}
            type="search"
            enterKeyHint="search"
          />
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => setKind(k.key)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${
                  kind === k.key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid auto-rows-min grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => {
            const out = p.kind === "goods" && (p.stock ?? 0) <= 0;
            return (
              <button
                key={p.id}
                type="button"
                disabled={out}
                onClick={() => add(p)}
                className="card relative p-3 text-left transition hover:border-brand-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:p-5"
              >
                {cart[p.id] ? (
                  <span className="absolute right-2 top-2 z-10 grid h-6 min-w-6 place-items-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
                    {cart[p.id]}
                  </span>
                ) : null}
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" loading="lazy" className="mb-2 aspect-[4/3] w-full rounded-lg object-cover" />
                )}
                <p className="text-xs text-slate-400">{p.sku}</p>
                <p className="mt-1 line-clamp-2 text-sm font-medium sm:text-base">{p.name}</p>
                <p className="mt-1 text-sm text-brand-700 sm:mt-2 sm:text-base">{vnd(p.price)}</p>
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

      <aside
        className={`space-y-4 bg-white p-4 lg:card lg:static lg:block lg:h-fit lg:overflow-visible lg:p-5 ${
          cartOpen ? "fixed inset-0 z-40 block overflow-y-auto pb-28" : "hidden"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Đơn hàng hiện tại</h2>
          <button type="button" onClick={() => setCartOpen(false)} aria-label="Đóng giỏ hàng" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden">
            <X size={22} />
          </button>
        </div>

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
                  <button type="button" onClick={() => change1(product.id, -1)} className="rounded-lg border p-2 sm:p-1" aria-label="Giảm">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center">{qty}</span>
                  <button type="button" onClick={() => change1(product.id, 1)} className="rounded-lg border p-2 sm:p-1" aria-label="Tăng">
                    <Plus size={14} />
                  </button>
                  <button type="button" onClick={() => remove(product.id)} className="rounded-lg p-2 text-rose-600 sm:p-1" aria-label="Xoá">
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
        {method === "cash" && total > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPaidText("")} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
              Vừa đủ
            </button>
            {QUICK_CASH.filter((v) => v >= total).slice(0, 3).map((v) => (
              <button key={v} type="button" onClick={() => setPaidText(String(v))} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                {v.toLocaleString("vi-VN")}
              </button>
            ))}
          </div>
        )}
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
          className="sticky bottom-3 w-full rounded-xl bg-brand-600 py-3 text-base font-medium text-white shadow-lg hover:bg-brand-700 disabled:opacity-50 lg:static lg:py-2.5 lg:text-sm lg:shadow-none"
        >
          {pending ? "Đang xử lý…" : "Thanh toán"}
        </button>
        {demo && <p className="text-xs text-slate-500">Chế độ demo: kết nối Supabase để tạo đơn thật.</p>}
      </aside>
      {/* Thanh giỏ hàng nổi trên điện thoại, nằm ngay trên thanh điều hướng dưới */}
      {lines.length > 0 && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between rounded-2xl bg-brand-600 px-4 py-3 text-white shadow-xl lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm">
            <ShoppingCart size={18} /> Giỏ hàng · {itemCount} món
          </span>
          <span className="font-semibold">{vnd(total)} ›</span>
        </button>
      )}

      {showDone && result?.ok && (
        <DoneDialog result={result} method={paidWith} bank={bank} onClose={() => setShowDone(false)} />
      )}
    </div>
  );
}

function DoneDialog({
  result, method, bank, onClose,
}: {
  result: Extract<CheckoutResult, { ok: true }>;
  method: string;
  bank: BankInfo | null;
  onClose: () => void;
}) {
  const due = Math.max(result.total - result.paid, 0);
  // Chuyển khoản / ví: QR đúng số tiền đã thu. Các hình thức khác còn nợ: QR cho phần còn thiếu.
  const qrAmount = method === "transfer" || method === "ewallet" ? result.paid : due;
  const showQr = !!bank && qrAmount > 0;
  const printUrl = `/orders/${result.orderId}?print=1`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">Đã tạo đơn {result.code}</p>
            <p className="text-sm text-slate-600">
              Tổng {vnd(result.total)} · đã thu {vnd(result.paid)}
              {due > 0 ? ` · còn nợ ${vnd(due)}` : ""}
            </p>
            {result.points > 0 && <p className="text-sm text-slate-500">Khách được cộng {result.points} điểm</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {showQr && bank && (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={vietQrUrl(bank, qrAmount, result.code)}
              alt={`Mã QR chuyển khoản ${vnd(qrAmount)}`}
              className="mx-auto w-56 rounded-xl border border-slate-200"
            />
            <p className="mt-2 text-sm font-medium">Quét để chuyển {vnd(qrAmount)}</p>
            <p className="text-xs text-slate-500">Nội dung: {result.code}</p>
          </div>
        )}
        {!showQr && !bank && (method === "transfer" || due > 0) && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Muốn hiện mã QR tự động? Chủ cửa hàng điền tài khoản ngân hàng ở Cài đặt.
          </p>
        )}

        <div className="flex gap-2">
          <a
            href={printUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Printer size={16} /> In hoá đơn
          </a>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100">
            Đơn mới
          </button>
        </div>
      </div>
    </div>
  );
}
