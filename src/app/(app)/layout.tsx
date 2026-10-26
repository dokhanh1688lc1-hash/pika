import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { getMembership } from "@/lib/auth";
import { listExpiring } from "@/lib/data/repo";
import type { BatchRow } from "@/lib/data/types";
import { isSupabaseConfigured } from "@/lib/env";
import { ROLE_LABEL } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const demo = !isSupabaseConfigured();
  const member = demo ? null : await getMembership();
  if (!demo && !member) redirect("/onboarding");

  let expiring: BatchRow[] = [];
  try {
    expiring = await listExpiring();
  } catch {
    // Cảnh báo là phụ: không để lỗi truy vấn làm hỏng cả trang
  }
  const expired = expiring.filter((b) => b.daysLeft < 0).length;
  const soon = expiring.length - expired;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="min-w-0 flex-1">
      <MobileNav />
      <main className="p-4 pb-28 md:p-8 md:pb-8 print:p-0">
        {demo && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 print:hidden">
            Đang chạy chế độ demo (chưa cấu hình Supabase) — dữ liệu hiển thị là dữ liệu mẫu.
            Xem hướng dẫn kết nối tại docs/SUPABASE_SETUP.md.
          </div>
        )}
        {expiring.length > 0 && (
          <Link
            href="/expiry"
            className={`mb-6 block rounded-xl border px-4 py-2 text-sm print:hidden ${
              expired > 0
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {expired > 0 && <strong>{expired} lô đã hết hạn</strong>}
            {expired > 0 && soon > 0 && " và "}
            {soon > 0 && <strong>{soon} lô sắp hết hạn</strong>}
            {" — bấm để xem và xử lý."}
          </Link>
        )}
        {member && (
          <div className="mb-6 hidden items-center justify-end gap-3 text-sm md:flex print:hidden">
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
    </div>
  );
}
