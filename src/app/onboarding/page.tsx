import { redirect } from "next/navigation";
import { getAuthUser, getMembership } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createStore } from "./actions";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/dashboard");
  if (!(await getAuthUser())) redirect("/login");
  if (await getMembership()) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form action={createStore} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Thiết lập cửa hàng</h1>
        <p className="text-sm text-slate-500">Bạn sẽ là chủ cửa hàng và có toàn quyền quản trị.</p>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <input
          name="storeName" required placeholder="Tên cửa hàng / spa"
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-400"
        />
        <input
          name="ownerName" required placeholder="Tên của bạn"
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-400"
        />
        <button className="w-full rounded-xl bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Tạo cửa hàng
        </button>
      </form>
    </main>
  );
}
