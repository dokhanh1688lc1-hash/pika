import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { Badge, Field, Notice, PageHeader, SubmitButton, Table, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { listCustomers } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { num, vnd } from "@/lib/format";
import { can } from "@/lib/rbac";
import { createCustomer } from "./actions";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; q?: string; new?: string }>;
}) {
  const { error, ok, q = "", new: openNew } = await searchParams;
  const [customers, member] = await Promise.all([
    listCustomers(),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  const canEdit = member ? can(member.role, "customers.manage") : false;
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? customers.filter((c) => c.name.toLowerCase().includes(needle) || (c.phone ?? "").includes(needle))
    : customers;
  const LIMIT = 200;
  const shown = filtered.slice(0, LIMIT);

  return (
    <>
      <PageHeader title="Khách hàng" subtitle="Hồ sơ khách hàng và tích điểm (1 điểm / 10.000đ). Bấm tên khách để xem lịch sử, sửa hoặc xoá." />
      <Notice error={error} ok={ok} />
      <form method="get" className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input name="q" defaultValue={q} placeholder="Tìm tên hoặc số điện thoại..." className={`${inputClass} rounded-full pl-10`} />
      </form>

      {canEdit && (
        <details id="new" className="card mb-6" open={openNew === "1"}>
          <summary className="cursor-pointer font-medium">+ Thêm khách hàng</summary>
          <form action={createCustomer} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Họ tên *"><input name="name" required className={inputClass} /></Field>
            <Field label="Điện thoại"><input name="phone" inputMode="tel" className={inputClass} placeholder="0901234567" /></Field>
            <Field label="Email"><input name="email" type="email" className={inputClass} /></Field>
            <Field label="Ngày sinh"><input name="birthday" type="date" className={inputClass} /></Field>
            <div className="sm:col-span-2"><Field label="Ghi chú"><input name="note" className={inputClass} /></Field></div>
            <div className="sm:col-span-2"><SubmitButton>Lưu khách hàng</SubmitButton></div>
          </form>
        </details>
      )}

      <div className="card mb-3 flex items-center justify-between">
        <p className="text-lg font-semibold">Khách hàng</p>
        <p className="text-xl font-semibold">{filtered.length.toLocaleString("vi-VN")}</p>
      </div>

      {/* Điện thoại: danh sách thẻ */}
      <ul className="card divide-y divide-pink-100 p-0 md:hidden">
        {shown.map((c) => (
          <li key={c.id}>
            <Link href={`/customers/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-brand-50">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-100 text-lg font-semibold text-brand-600">
                {(c.name.trim()[0] ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{c.name}</p>
                <p className="truncate text-sm text-slate-500">{c.phone || "Chưa có SĐT"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-semibold">{vnd(c.totalSpent)}</p>
                <p className="text-xs text-slate-500"><Badge tone="violet">{c.tier}</Badge> · {num(c.points)} điểm</p>
              </div>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Chưa có khách hàng nào.</li>}
      </ul>

      <div className="hidden md:block">
      <Table head={["Khách hàng", "Điện thoại", "Hạng", "Điểm", "Tổng chi tiêu", "Lần cuối"]}>
        {shown.map((c) => (
          <tr key={c.id}>
            <td className="td font-medium">
              <Link href={`/customers/${c.id}`} className="text-brand-700 hover:underline">{c.name}</Link>
            </td>
            <td className="td">{c.phone}</td>
            <td className="td"><Badge tone="violet">{c.tier}</Badge></td>
            <td className="td">{num(c.points)}</td>
            <td className="td">{vnd(c.totalSpent)}</td>
            <td className="td text-slate-500">{c.lastVisit}</td>
          </tr>
        ))}
        {shown.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={6}>Chưa có khách hàng nào.</td></tr>
        )}
      </Table>
      </div>
      {filtered.length > LIMIT && (
        <p className="mt-2 text-center text-sm text-slate-500">Đang hiện {LIMIT}/{filtered.length} khách — hãy tìm kiếm để thu hẹp.</p>
      )}
      {canEdit && (
        <Link
          href="/customers?new=1#new"
          aria-label="Thêm khách hàng"
          className="fixed bottom-24 right-4 z-20 grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-lg active:scale-95 md:hidden print:hidden"
        >
          <Plus size={28} />
        </Link>
      )}
    </>
  );
}
