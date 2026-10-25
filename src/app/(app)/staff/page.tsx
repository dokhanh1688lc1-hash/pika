import { RemoveStaffButton } from "@/components/RemoveStaffButton";
import { Field, Notice, PageHeader, SubmitButton, Table, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { listStaff, listStaffAccounts } from "@/lib/data/repo";
import { isSupabaseConfigured } from "@/lib/env";
import { vnd } from "@/lib/format";
import { ROLE_LABEL, can, type Role } from "@/lib/rbac";
import { createStaff, createStaffAccount, removeStaff, resetStaffPassword, revokeStaffAccount } from "./actions";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const [staff, accounts, member] = await Promise.all([
    listStaff(),
    listStaffAccounts(),
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
            Thêm nhân viên rồi bấm "Cấp tài khoản" ở bảng bên dưới để họ đăng nhập bằng email và mật khẩu, với quyền theo vai trò. Nhân viên chỉ thêm tên (không cấp tài khoản) vẫn gắn được vào đơn hàng để tính hoa hồng.
          </p>
        </details>
      )}

      <Table head={["Nhân viên", "Vai trò", "Tài khoản đăng nhập", "Doanh thu tháng", "% hoa hồng", "Hoa hồng tạm tính", ""]}>
        {staff.map((s) => (
          <tr key={s.id}>
            <td className="td font-medium">{s.name}</td>
            <td className="td">{ROLE_LABEL[s.role as Role] ?? s.role}</td>
            <td className="td align-top">
              {accounts[s.id] ? <span>{accounts[s.id]}</span> : <span className="text-slate-400">Chưa có</span>}
              {canEdit && s.role !== "owner" && (s.role !== "manager" || member?.role === "owner") && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-brand-700">{accounts[s.id] ? "Quản lý tài khoản" : "Cấp tài khoản"}</summary>
                  <div className="mt-2 w-64 space-y-3 rounded-xl border border-slate-200 p-3">
                    {accounts[s.id] ? (
                      <>
                        <form action={resetStaffPassword} className="space-y-2">
                          <input type="hidden" name="id" value={s.id} />
                          <Field label="Mật khẩu mới"><input name="password" type="text" minLength={8} required className={inputClass} /></Field>
                          <SubmitButton>Đổi mật khẩu</SubmitButton>
                        </form>
                        <form action={revokeStaffAccount}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="text-xs text-rose-700 hover:underline">Thu hồi tài khoản</button>
                        </form>
                      </>
                    ) : (
                      <form action={createStaffAccount} className="space-y-2">
                        <input type="hidden" name="id" value={s.id} />
                        <Field label="Email đăng nhập"><input name="email" type="email" required className={inputClass} /></Field>
                        <Field label="Mật khẩu (từ 8 ký tự)"><input name="password" type="text" minLength={8} required className={inputClass} /></Field>
                        <SubmitButton>Cấp tài khoản</SubmitButton>
                      </form>
                    )}
                  </div>
                </details>
              )}
            </td>
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
          <tr><td className="td text-slate-500" colSpan={7}>Chưa có nhân viên nào.</td></tr>
        )}
      </Table>
    </>
  );
}
