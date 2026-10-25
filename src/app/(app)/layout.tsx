import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { Sidebar } from "@/components/Sidebar";
import { getMembership } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { ROLE_LABEL } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const demo = !isSupabaseConfigured();
  const member = demo ? null : await getMembership();
  if (!demo && !member) redirect("/onboarding");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 p-6 md:p-8">
        {demo && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Đang chạy chế độ demo (chưa cấu hình Supabase) — dữ liệu hiển thị là dữ liệu mẫu.
            Xem hướng dẫn kết nối tại docs/SUPABASE_SETUP.md.
          </div>
        )}
        {member && (
          <div className="mb-6 flex items-center justify-end gap-3 text-sm">
            <span className="text-slate-600">
              {member.name} · {ROLE_LABEL[member.role]}
            </span>
            <form action={signOut}>
              <button className="rounded-lg border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-100">
                Đăng xuất
              </button>
            </form>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
