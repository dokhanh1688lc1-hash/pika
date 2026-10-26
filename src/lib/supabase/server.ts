import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { SESSION_ONLY_COOKIE, toSessionCookie, type CookieToSet } from "./cookies";

/** Client phía server gắn với phiên đăng nhập (cookie) của người dùng hiện tại. */
export async function getServerClient() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: CookieToSet[]) => {
        try {
          const sessionOnly = store.get(SESSION_ONLY_COOKIE)?.value === "1";
          list.forEach(({ name, value, options }) =>
            store.set(name, value, sessionOnly && value ? toSessionCookie(options) : options));
        } catch {
          // Gọi từ Server Component: bỏ qua, middleware sẽ làm mới phiên.
        }
      },
    },
  });
}
