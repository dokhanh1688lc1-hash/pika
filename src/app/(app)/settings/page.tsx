import { Badge, Field, Notice, PageHeader, SubmitButton, inputClass } from "@/components/ui";
import { getMembership } from "@/lib/auth";
import { getStoreInfo } from "@/lib/data/repo";
import { BANKS } from "@/lib/vietqr";
import { can } from "@/lib/rbac";
import { env, isSupabaseConfigured } from "@/lib/env";
import { ROLE_LABEL, ROLE_PERMISSIONS, type Role } from "@/lib/rbac";
import { headers } from "next/headers";
import { telegramStatus } from "@/lib/telegram/admin";
import { createTelegramLinkCode, registerTelegramWebhook, removeTelegramWebhook, saveStoreInfo, sendTelegramTest } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; ok?: string }>;
}) {
  const { code, error, ok } = await searchParams;
  const db = isSupabaseConfigured();
  const member = db ? await getMembership() : null;
  const canStore = !!member && can(member.role, "settings.manage");
  const store = canStore ? await getStoreInfo() : null;
  const tg = canStore ? await telegramStatus() : null;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const expectedUrl = host ? `https://${host}/api/telegram/webhook` : "";
  const integrations = [
    ["Cơ sở dữ liệu (Supabase)", db],
    ["Telegram Bot", Boolean(env.telegramToken && env.telegramSecret)],
    ["AI Agent (Anthropic)", Boolean(env.anthropicKey)],
  ] as const;

  return (
    <>
      <PageHeader title="Cài đặt" subtitle="Tích hợp và phân quyền" />
      <Notice error={error} ok={ok} />

      {store && (
        <section className="card mb-6">
          <h2 className="mb-1 font-medium">Cửa hàng & thanh toán QR</h2>
          <p className="mb-4 text-sm text-slate-500">
            Thông tin in trên hoá đơn. Điền tài khoản ngân hàng để màn hình bán hàng tự hiện mã QR (VietQR) với đúng số tiền và nội dung là mã đơn.
          </p>
          <form action={saveStoreInfo} className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên cửa hàng *"><input name="name" required defaultValue={store.name} className={inputClass} /></Field>
            <Field label="Điện thoại"><input name="phone" defaultValue={store.phone} className={inputClass} /></Field>
            <div className="sm:col-span-2"><Field label="Địa chỉ"><input name="address" defaultValue={store.address} className={inputClass} /></Field></div>
            <Field label="Ngân hàng">
              <select name="bankCode" defaultValue={store.bank?.code ?? ""} className={inputClass}>
                <option value="">— Không dùng QR —</option>
                {BANKS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Số tài khoản"><input name="bankAccount" inputMode="numeric" defaultValue={store.bank?.account ?? ""} className={inputClass} /></Field>
            <div className="sm:col-span-2"><Field label="Tên chủ tài khoản (không dấu)"><input name="bankHolder" defaultValue={store.bank?.holder ?? ""} className={inputClass} /></Field></div>
            <div className="sm:col-span-2"><SubmitButton>Lưu</SubmitButton></div>
          </form>
        </section>
      )}

      <section className="card mb-6">
        <h2 className="mb-3 font-medium">Tích hợp</h2>
        <ul className="space-y-2 text-sm">
          {integrations.map(([name, ok]) => (
            <li key={name} className="flex justify-between">
              <span>{name}</span>
              <Badge tone={ok ? "green" : "amber"}>{ok ? "Đã kết nối" : "Chưa cấu hình"}</Badge>
            </li>
          ))}
        </ul>
      </section>

      {tg && (
        <section className="card mb-6">
          <h2 className="mb-1 font-medium">Telegram Bot — trạng thái & đăng ký webhook</h2>
          <p className="mb-4 text-sm text-slate-500">
            Bot chỉ trả lời khi webhook đã đăng ký đúng địa chỉ website này. Bấm &quot;Đăng ký webhook&quot; là xong, không cần gõ lệnh hay đường dẫn thủ công.
          </p>
          <ul className="mb-4 space-y-2 text-sm">
            <li className="flex justify-between gap-3">
              <span>Token bot (TELEGRAM_BOT_TOKEN)</span>
              {tg.bot ? <Badge tone="green">@{tg.bot.username}</Badge>
                : <Badge tone="red">{tg.tokenSet ? "Token sai / đã bị thu hồi" : "Chưa đặt"}</Badge>}
            </li>
            <li className="flex justify-between gap-3">
              <span>Secret (TELEGRAM_WEBHOOK_SECRET)</span>
              <Badge tone={tg.secretSet && tg.secretValid ? "green" : "red"}>
                {!tg.secretSet ? "Chưa đặt" : tg.secretValid ? "Hợp lệ" : "Chứa ký tự không hợp lệ"}
              </Badge>
            </li>
            <li className="flex justify-between gap-3">
              <span>Webhook</span>
              {tg.webhook?.url
                ? <Badge tone={tg.webhook.url === expectedUrl ? "green" : "amber"}>
                    {tg.webhook.url === expectedUrl ? "Đã đăng ký đúng" : "Đang trỏ địa chỉ khác"}
                  </Badge>
                : <Badge tone="red">Chưa đăng ký</Badge>}
            </li>
          </ul>
          {tg.tokenError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Telegram báo: {tg.tokenError}. Lấy token mới ở @BotFather, cập nhật trên Vercel rồi Redeploy.</p>}
          {tg.webhook?.url && tg.webhook.url !== expectedUrl && (
            <p className="mb-3 break-all rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Hiện trỏ tới: {tg.webhook.url}<br />Cần là: {expectedUrl}
            </p>
          )}
          {tg.webhook && tg.webhook.pending > 0 && (
            <p className="mb-3 text-sm text-slate-600">Tin đang chờ xử lý: {tg.webhook.pending}</p>
          )}
          {tg.webhook?.lastErrorMessage && (
            <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Lỗi gần nhất Telegram gặp khi gọi website: <strong>{tg.webhook.lastErrorMessage}</strong>
              {tg.webhook.lastErrorDate ? ` (${new Date(tg.webhook.lastErrorDate * 1000).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })})` : ""}
              <br />
              <span className="text-xs">
                401 = secret không khớp, hãy bấm Đăng ký lại · 404/500 = website chưa deploy bản mới hoặc lỗi server (xem Vercel → Logs).
              </span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <form action={registerTelegramWebhook}>
              <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                {tg.webhook?.url ? "Đăng ký lại webhook" : "Đăng ký webhook"}
              </button>
            </form>
            <form action={sendTelegramTest}>
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-100">Gửi tin thử cho tôi</button>
            </form>
            {tg.webhook?.url && (
              <form action={removeTelegramWebhook}>
                <button className="rounded-xl border border-rose-200 px-4 py-2 text-sm text-rose-700 hover:bg-rose-50">Gỡ webhook</button>
              </form>
            )}
          </div>
        </section>
      )}

      <section className="card mb-6">
        <h2 className="mb-1 font-medium">Liên kết Telegram</h2>
        <p className="mb-3 text-sm text-slate-500">
          Tạo mã rồi nhắn cho bot: <code className="rounded bg-slate-100 px-1">/start &lt;mã&gt;</code>. Mã dùng một lần,
          gắn bot với tài khoản của bạn và đúng quyền hạn của bạn.
        </p>
        {code && (
          <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm">
            Mã của bạn: <code className="font-semibold">{code}</code> — gửi <code>/start {code}</code> cho bot.
          </p>
        )}
        {db ? (
          <form action={createTelegramLinkCode}>
            <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Tạo mã liên kết
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-400">Cần kết nối Supabase để dùng tính năng này.</p>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-medium">Vai trò & quyền hạn</h2>
        <ul className="space-y-3 text-sm">
          {(Object.keys(ROLE_PERMISSIONS) as Role[]).map((r) => (
            <li key={r}>
              <p className="font-medium">{ROLE_LABEL[r]}</p>
              <p className="text-slate-500">{ROLE_PERMISSIONS[r].join(", ")}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
