import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Client phía server gắn với phiên đăng nhập (cookie) của người dùng hiện tại. */
export async function getServerClient() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Gọi từ Server Component: bỏ qua, middleware sẽ làm mới phiên.
        }
      },
    },
  });
}
