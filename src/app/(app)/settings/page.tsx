import { Badge, PageHeader } from "@/components/ui";
import { env, isSupabaseConfigured } from "@/lib/env";
import { ROLE_LABEL, ROLE_PERMISSIONS, type Role } from "@/lib/rbac";

export default function SettingsPage() {
  const integrations = [
    ["Cơ sở dữ liệu (Supabase)", isSupabaseConfigured()],
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
