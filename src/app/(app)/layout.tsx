import { Sidebar } from "@/components/Sidebar";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const demo = !isSupabaseConfigured();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 p-6 md:p-8">
        {demo && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Đang chạy chế độ demo (chưa cấu hình Supabase) — dữ liệu hiển thị là dữ liệu mẫu.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
