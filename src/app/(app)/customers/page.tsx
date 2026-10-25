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
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const [customers, member] = await Promise.all([
    listCustomers(),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  const canEdit = member ? can(member.role, "customers.manage") : false;

  return (
    <>
      <PageHeader title="Khách hàng" subtitle="Hồ sơ khách hàng và tích điểm (1 điểm / 10.000đ). Bấm tên khách để xem lịch sử, sửa hoặc xoá." />
      <Notice error={error} ok={ok} />

      {canEdit && (
        <details className="card mb-6">
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

      <Table head={["Khách hàng", "Điện thoại", "Hạng", "Điểm", "Tổng chi tiêu", "Lần cuối"]}>
        {customers.map((c) => (
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
        {customers.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={6}>Chưa có khách hàng nào.</td></tr>
        )}
      </Table>
    </>
  );
}
