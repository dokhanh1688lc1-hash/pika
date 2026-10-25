import Link from "next/link";
import { Badge, Field, Notice, PageHeader, SubmitButton, inputClass, StatCard, Table } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { listExpiring } from "@/lib/data/repo";
import { env, isSupabaseConfigured } from "@/lib/env";
import { EXPIRY_LABEL, EXPIRY_TONE, daysText, expiryLevel, fmtDate } from "@/lib/expiry";
import { can } from "@/lib/rbac";
import { disposeBatch, updateBatch } from "./actions";

const WINDOWS = [30, 60, 90];

export default async function ExpiryPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const requested = Number(sp.days);
  const days = WINDOWS.includes(requested) ? requested : env.expiryAlertDays;

  const [rows, member] = await Promise.all([
    listExpiring(days),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  const canDispose = member ? can(member.role, "inventory.manage") : false;
  const expired = rows.filter((r) => r.daysLeft < 0);
  const critical = rows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 7);
  const units = (list: typeof rows) => list.reduce((s, r) => s + r.quantity, 0);

  return (
    <>
      <PageHeader
        title="Hạn sử dụng"
        subtitle="Theo dõi lô hàng sắp hết hạn. Bán hàng tự lấy lô cận date trước và không bán hàng đã hết hạn."
      />
      <Notice error={sp.error} ok={sp.ok} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Đã hết hạn" value={`${expired.length} lô`} hint={`${units(expired)} sản phẩm cần huỷ`} />
        <StatCard label="Còn ≤ 7 ngày" value={`${critical.length} lô`} hint={`${units(critical)} sản phẩm`} />
        <StatCard label={`Trong ${days} ngày tới`} value={`${rows.length} lô`} hint={`${units(rows)} sản phẩm`} />
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        {WINDOWS.map((w) => (
          <Link
            key={w}
            href={`/expiry?days=${w}`}
            className={`rounded-full px-3 py-1 ${
              w === days ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {w} ngày
          </Link>
        ))}
      </div>

      <Table head={["Sản phẩm", "Lô", "Số lượng", "Hạn sử dụng", "Tình trạng", ""]}>
        {rows.map((r) => {
          const level = expiryLevel(r.daysLeft);
          return (
            <tr key={r.id}>
              <td className="td"><span className="font-medium">{r.product}</span> <span className="text-slate-400">{r.sku}</span></td>
              <td className="td">{r.batchCode || "—"}</td>
              <td className="td">{r.quantity}</td>
              <td className="td">{fmtDate(r.expiryDate)} <span className="text-slate-500">({daysText(r.daysLeft)})</span></td>
              <td className="td"><Badge tone={EXPIRY_TONE[level]}>{EXPIRY_LABEL[level]}</Badge></td>
              <td className="td">
                {canDispose && (
                  <div className="flex items-start justify-end gap-2">
                    <details>
                      <summary className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100">
                        Sửa
                      </summary>
                      <form action={updateBatch} className="mt-2 w-60 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-left">
                        <input type="hidden" name="batchId" value={r.id} />
                        <Field label="Hạn sử dụng"><input name="expiry" type="date" required defaultValue={r.expiryDate} className={inputClass} /></Field>
                        <Field label="Số lô"><input name="batchCode" defaultValue={r.batchCode} className={inputClass} /></Field>
                        <SubmitButton>Lưu</SubmitButton>
                      </form>
                    </details>
                    {r.daysLeft < 0 && (
                      <form action={disposeBatch}>
                        <input type="hidden" name="batchId" value={r.id} />
                        <button className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50">
                          Huỷ lô
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
        {rows.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={6}>
            Không có lô nào hết hạn trong {days} ngày tới. Nhập hạn sử dụng khi nhập kho để được theo dõi ở đây.
          </td></tr>
        )}
      </Table>
    </>
  );
}
