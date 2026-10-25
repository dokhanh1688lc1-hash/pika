import { RemoveStaffButton } from "@/components/RemoveStaffButton";
import { Field, Notice, PageHeader, SubmitButton, Table, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { listStaff } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { vnd } from "@/lib/format";
import { ROLE_LABEL, can, type Role } from "@/lib/rbac";
import { createStaff, removeStaff } from "./actions";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const [staff, member] = await Promise.all([
    listStaff(),
    isSupabaseConfigured() ? getMembership() : Promise.resolve(null),
  ]);
  const canEdit = member ? can(member.role, "staff.manage") : false;

  return (
    <>
      <PageHeader title="Nhân viên" subtitle="Hiệu suất và hoa hồng theo tháng (tính từ đơn hàng đã gắn nhân viên thực hiện)" />
      <Notice error={error} ok={ok} />

      {canEdit && (
        <details className="card mb-6">
          <summary className="cursor-pointer font-medium">+ Thêm nhân viên</summary>
          <form action={createStaff} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Họ tên *"><input name="name" required className={inputClass} /></Field>
            <Field label="Điện thoại"><input name="phone" inputMode="tel" className={inputClass} /></Field>
            <Field label="Vai trò">
              <select name="role" className={inputClass} defaultValue="technician">
                <option value="technician">Kỹ thuật viên</option>
                <option value="cashier">Thu ngân</option>
                <option value="stock_keeper">Thủ kho</option>
                <option value="manager">Quản lý</option>
              </select>
            </Field>
            <Field label="Hoa hồng (%)"><input name="commission" inputMode="decimal" className={inputClass} defaultValue="0" /></Field>
            <div className="sm:col-span-2"><SubmitButton>Lưu nhân viên</SubmitButton></div>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            Nhân viên được thêm ở đây dùng để gắn vào đơn hàng và tính hoa hồng. Cấp tài khoản đăng nhập sẽ bổ sung ở bước sau.
          </p>
        </details>
      )}

      <Table head={["Nhân viên", "Vai trò", "Doanh thu tháng", "% hoa hồng", "Hoa hồng tạm tính", ""]}>
        {staff.map((s) => (
          <tr key={s.id}>
            <td className="td font-medium">{s.name}</td>
            <td className="td">{ROLE_LABEL[s.role as Role] ?? s.role}</td>
            <td className="td">{vnd(s.monthRevenue)}</td>
            <td className="td">{(s.commissionRate * 100).toFixed(0)}%</td>
            <td className="td">{vnd(Math.round(s.monthRevenue * s.commissionRate))}</td>
            <td className="td text-right">
              {canEdit && s.role !== "owner" && s.id !== member?.staffId && (s.role !== "manager" || member?.role === "owner") && (
                <RemoveStaffButton id={s.id} name={s.name} action={removeStaff} />
              )}
            </td>
          </tr>
        ))}
        {staff.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={6}>Chưa có nhân viên nào.</td></tr>
        )}
      </Table>
    </>
  );
}
