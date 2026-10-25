import Link from "next/link";
import { ConfirmForm } from "@/components/ConfirmButton";
import { Badge, Field, Notice, PageHeader, SubmitButton, Table, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { appointmentCounts, listAppointmentsOn, listCustomers, listProducts, listStaff } from "@/lib/data/repo";
import type { AppointmentFull } from "@/lib/data/types";
import { isSupabaseConfigured } from "@/lib/env";
import { addDays, isIsoDate, vnToday } from "@/lib/period";
import { can } from "@/lib/rbac";
import { createAppointment, deleteAppointment, setAppointmentStatus, updateAppointment } from "./actions";

const STATUS = {
  booked: ["Đã đặt", "blue"],
  in_progress: ["Đang làm", "amber"],
  done: ["Hoàn thành", "green"],
  cancelled: ["Đã huỷ", "red"],
} as const;

const NEXT: Record<string, { to: keyof typeof STATUS; label: string }[]> = {
  booked: [{ to: "in_progress", label: "Bắt đầu" }, { to: "cancelled", label: "Huỷ lịch" }],
  in_progress: [{ to: "done", label: "Hoàn thành" }, { to: "cancelled", label: "Huỷ lịch" }],
  done: [],
  cancelled: [{ to: "booked", label: "Đặt lại" }],
};

const hm = (iso: string) =>
  new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
const dmy = (d: string) => d.split("-").reverse().join("/");
const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const today = vnToday();
  const date = isIsoDate(sp.date) ? sp.date : today;
  const configured = isSupabaseConfigured();

  const strip = Array.from({ length: 7 }, (_, i) => addDays(date, i - 3));
  const [appts, counts, customers, products, staff, member] = await Promise.all([
    listAppointmentsOn(date),
    appointmentCounts(strip[0], strip[6]),
    listCustomers(),
    listProducts(),
    listStaff(),
    configured ? getMembership() : Promise.resolve(null),
  ]);
  const canEdit = member ? can(member.role, "appointments.manage") : false;
  const services = products.filter((p) => p.kind !== "goods");

  return (
    <>
      <PageHeader title="Lịch hẹn" subtitle={`Ngày ${dmy(date)}${date === today ? " (hôm nay)" : ""}. Đặt lịch, đổi giờ, đổi trạng thái hoặc xoá.`} />
      <Notice error={sp.error} ok={sp.ok} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/appointments?date=${addDays(date, -1)}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100">←</Link>
        {strip.map((d) => {
          const wd = WEEKDAY[new Date(`${d}T12:00:00Z`).getUTCDay()];
          return (
            <Link
              key={d}
              href={`/appointments?date=${d}`}
              className={`rounded-xl px-3 py-1.5 text-center text-sm ${
                d === date ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              <span className="block text-xs opacity-80">{wd}{d === today ? " · nay" : ""}</span>
              {d.slice(8)}/{d.slice(5, 7)}
              {counts[d] ? <span className="ml-1 text-xs opacity-80">({counts[d]})</span> : null}
            </Link>
          );
        })}
        <Link href={`/appointments?date=${addDays(date, 1)}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100">→</Link>
        <form action="/appointments" className="ml-auto flex items-center gap-2">
          <input type="date" name="date" defaultValue={date} className={`${inputClass} !w-auto`} />
          <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100">Xem</button>
        </form>
      </div>

      {canEdit && (
        <details className="card mb-6">
          <summary className="cursor-pointer font-medium">+ Đặt lịch hẹn</summary>
          <form action={createAppointment} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ApptFields date={date} customers={customers} services={services} staff={staff} />
            <div className="sm:col-span-2 lg:col-span-3"><SubmitButton>Đặt lịch</SubmitButton></div>
          </form>
        </details>
      )}

      <Table head={["Giờ", "Khách hàng", "Dịch vụ", "Nhân viên", "Trạng thái", ""]}>
        {appts.map((a) => (
          <tr key={a.id} className="align-top">
            <td className="td font-medium">{hm(a.startsAt)}–{hm(a.endsAt)}</td>
            <td className="td">{a.customer}{a.note && <div className="text-xs text-slate-500">{a.note}</div>}</td>
            <td className="td">{a.service}</td>
            <td className="td">{a.staff || "—"}</td>
            <td className="td"><Badge tone={STATUS[a.status][1]}>{STATUS[a.status][0]}</Badge></td>
            <td className="td">
              {canEdit && (
                <div className="space-y-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    {NEXT[a.status].map((n) => (
                      <form key={n.to} action={setAppointmentStatus}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="date" value={date} />
                        <input type="hidden" name="status" value={n.to} />
                        <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs hover:bg-slate-100">{n.label}</button>
                      </form>
                    ))}
                    <ConfirmForm action={deleteAppointment} hidden={{ id: a.id, date }} message="Xoá lịch hẹn này?">
                      <button className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50">Xoá</button>
                    </ConfirmForm>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-right text-xs text-brand-700">Sửa lịch</summary>
                    <form action={updateAppointment} className="mt-2 w-72 space-y-2 rounded-xl border border-slate-200 p-3">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="oldDate" value={date} />
                      <ApptFields appt={a} date={dayOf(a.startsAt)} customers={customers} services={services} staff={staff} compact />
                      <SubmitButton>Lưu</SubmitButton>
                    </form>
                  </details>
                </div>
              )}
            </td>
          </tr>
        ))}
        {appts.length === 0 && (
          <tr><td className="td text-slate-500" colSpan={6}>Không có lịch hẹn nào trong ngày này.</td></tr>
        )}
      </Table>
    </>
  );
}

function ApptFields({
  appt, date, customers, services, staff, compact,
}: {
  appt?: AppointmentFull;
  date: string;
  customers: { id: string; name: string; phone: string }[];
  services: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  compact?: boolean;
}) {
  return (
    <>
      <Field label="Khách hàng *">
        <select name="customerId" required defaultValue={appt?.customerId ?? ""} className={inputClass}>
          <option value="" disabled>— Chọn —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
        </select>
      </Field>
      <Field label="Dịch vụ *">
        <select name="productId" required defaultValue={appt?.productId ?? ""} className={inputClass}>
          <option value="" disabled>— Chọn —</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Nhân viên">
        <select name="staffId" defaultValue={appt?.staffId ?? ""} className={inputClass}>
          <option value="">— Chưa chọn —</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Ngày *"><input name="date" type="date" required defaultValue={date} className={inputClass} /></Field>
      <Field label="Giờ *">
        <input name="time" type="time" required defaultValue={appt ? hm(appt.startsAt) : "09:00"} className={inputClass} />
      </Field>
      <div className={compact ? "" : "sm:col-span-2 lg:col-span-1"}>
        <Field label="Ghi chú"><input name="note" defaultValue={appt?.note ?? ""} className={inputClass} /></Field>
      </div>
    </>
  );
}
