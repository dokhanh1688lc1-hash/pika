import { Sparkles } from "lucide-react";
import { signIn, signUp } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const { error, info } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <Sparkles size={18} />
          </span>
          <span className="text-lg font-semibold text-brand-700">PiKa Store</span>
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {info && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-700">{info}</p>}
        <input
          name="email" type="email" required placeholder="Email" autoComplete="email"
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-400"
        />
        <input
          name="password" type="password" required minLength={8} placeholder="Mật khẩu (tối thiểu 8 ký tự)"
          autoComplete="current-password"
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-400"
        />
        <button formAction={signIn} className="w-full rounded-xl bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Đăng nhập
        </button>
        <button formAction={signUp} className="w-full rounded-xl border border-slate-200 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Tạo tài khoản mới
        </button>
      </form>
    </main>
  );
}
