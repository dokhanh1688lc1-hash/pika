import { env, isSupabaseConfigured } from "@/lib/env";
import type { Role } from "@/lib/rbac";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerClient } from "@/lib/supabase/server";

export interface Membership {
  userId: string;
  email: string;
  staffId: string;
  storeId: string;
  name: string;
  role: Role;
}

/** Người dùng đang đăng nhập (null nếu chưa đăng nhập hoặc đang ở chế độ demo). */
export async function getAuthUser() {
  if (!isSupabaseConfigured() || !env.supabaseAnonKey) return null;
  const supabase = await getServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Hồ sơ nhân viên + cửa hàng của người dùng đăng nhập (null nếu chưa tạo cửa hàng). */
export async function getMembership(): Promise<Membership | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const { data } = await getAdminClient()
    .from("staff")
    .select("id, store_id, name, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  return {
    userId: user.id,
    email: user.email ?? "",
    staffId: data.id,
    storeId: data.store_id,
    name: data.name,
    role: data.role as Role,
  };
}

/**
 * Cửa hàng áp dụng cho truy vấn hiện tại.
 * - Đã đăng nhập: luôn là cửa hàng của người đó ("" nếu chưa có -> không trả dữ liệu nào).
 * - Không có phiên (chỉ xảy ra ở kênh server-to-server như Telegram allowlist): DEFAULT_STORE_ID.
 */
export async function currentStoreId(): Promise<string> {
  const user = await getAuthUser();
  if (user) return (await getMembership())?.storeId ?? "";
  return process.env.DEFAULT_STORE_ID ?? "";
}
