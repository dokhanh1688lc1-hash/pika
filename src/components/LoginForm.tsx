"use client";

import { Eye, EyeOff, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "pika.login.email";
const input = "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-400";

type Act = (form: FormData) => void | Promise<void>;

/** Form đăng nhập: có "Ghi nhớ đăng nhập" (giữ phiên lâu dài + nhớ email) và nút hiện/ẩn mật khẩu. */
export function LoginForm({
  signIn, signUp, error, info,
}: { signIn: Act; signUp: Act; error?: string; info?: string }) {
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setEmail(saved);
    } catch { /* trình duyệt chặn lưu trữ: bỏ qua */ }
  }, []);

  function persist() {
    try {
      if (remember && email) localStorage.setItem(KEY, email);
      else localStorage.removeItem(KEY);
    } catch { /* bỏ qua */ }
  }

  return (
    <form className="card w-full max-w-sm space-y-4">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><Sparkles size={18} /></span>
        <span className="text-lg font-semibold text-brand-700">PiKa Store</span>
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {info && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-700">{info}</p>}
      <input
        name="email" type="email" required placeholder="Email" autoComplete="email"
        value={email} onChange={(e) => setEmail(e.target.value)} className={input}
      />
      <div className="relative">
        <input
          name="password" type={show ? "text" : "password"} required minLength={8}
          placeholder="Mật khẩu (tối thiểu 8 ký tự)" autoComplete="current-password" className={`${input} pr-11`}
        />
        <button
          type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox" name="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 accent-pink-600"
        />
        Ghi nhớ đăng nhập
      </label>
      <button formAction={signIn} onClick={persist} className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
        Đăng nhập
      </button>
      <button formAction={signUp} className="w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
        Tạo tài khoản mới
      </button>
    </form>
  );
}
