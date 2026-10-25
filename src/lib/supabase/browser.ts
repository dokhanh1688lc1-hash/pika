import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/** Client trình duyệt — tuân thủ RLS theo phiên đăng nhập của người dùng. */
export function getBrowserClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
