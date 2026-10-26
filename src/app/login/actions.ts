"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_ONLY_COOKIE } from "@/lib/supabase/cookies";
import { getServerClient } from "@/lib/supabase/server";

const back = (key: "error" | "info", msg: string): never =>
  redirect(`/login?${key}=${encodeURIComponent(msg)}`);

function readCreds(form: FormData) {
  return {
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  };
}

export async function signIn(form: FormData) {
  const { email, password } = readCreds(form);
  if (!email || !password) back("error", "Vui lòng nhập email và mật khẩu");
  // Không tick "Ghi nhớ đăng nhập": phiên chỉ sống đến khi đóng trình duyệt
  const remember = form.get("remember") === "on";
  const jar = await cookies();
  if (remember) jar.delete(SESSION_ONLY_COOKIE);
  else jar.set(SESSION_ONLY_COOKIE, "1", { path: "/", sameSite: "lax", secure: true, httpOnly: true });
  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) back("error", "Email hoặc mật khẩu không đúng");
  redirect("/dashboard");
}

export async function signUp(form: FormData) {
  const { email, password } = readCreds(form);
  if (!email || password.length < 8) back("error", "Email hợp lệ và mật khẩu tối thiểu 8 ký tự");
  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) back("error", error.message);
  if (!data.session) back("info", "Đã gửi email xác nhận. Xác nhận xong hãy đăng nhập.");
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  (await cookies()).delete(SESSION_ONLY_COOKIE);
  redirect("/login");
}
