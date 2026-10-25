import { Badge, PageHeader } from "@/components/ui";
import { env, isSupabaseConfigured } from "@/lib/env";
import { ROLE_LABEL, ROLE_PERMISSIONS, type Role } from "@/lib/rbac";
import { createTelegramLinkCode } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code, error } = await searchParams;
  const db = isSupabaseConfigured();
  const integrations = [
    ["Cơ sở dữ liệu (Supabase)", db],
    ["Telegram Bot", Boolean(env.telegramToken && env.telegramSecret)],
    ["AI Agent (Anthropic)", Boolean(env.anthropicKey)],
  ] as const;

  return (
    <>
      <PageHeader title="Cài đặt" subtitle="Tích hợp và phân quyền" />
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

      <section className="card mb-6">
        <h2 className="mb-1 font-medium">Liên kết Telegram</h2>
        <p className="mb-3 text-sm text-slate-500">
          Tạo mã rồi nhắn cho bot: <code className="rounded bg-slate-100 px-1">/start &lt;mã&gt;</code>. Mã dùng một lần,
          gắn bot với tài khoản của bạn và đúng quyền hạn của bạn.
        </p>
        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
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
