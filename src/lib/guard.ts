import { redirect } from "next/navigation";
import { getMembership, type Membership } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { can, type Permission } from "@/lib/rbac";
import { getAdminClient } from "@/lib/supabase/admin";

/** Quay về trang `path` kèm thông báo (hiển thị bằng <Notice />). */
export function redirectMsg(path: string, key: "error" | "ok", msg: string): never {
  return redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`);
}

/** Yêu cầu: đã kết nối DB, đã đăng nhập và có quyền. Sai thì quay về `back` kèm thông báo. */
export async function requireMember(permission: Permission, back: string): Promise<Membership> {
  if (!isSupabaseConfigured()) {
    return redirectMsg(back, "error", "Đang ở chế độ demo: hãy kết nối Supabase để lưu dữ liệu.");
  }
  const member = await getMembership();
  if (!member) return redirect("/login");
  if (!can(member.role, permission)) {
    return redirectMsg(back, "error", "Bạn không có quyền thực hiện thao tác này.");
  }
  return member;
}

/** Chi nhánh mặc định của cửa hàng (nơi bán hàng và nhập kho). */
export async function defaultBranchId(storeId: string): Promise<string | null> {
  const { data } = await getAdminClient()
    .from("branches")
    .select("id")
    .eq("store_id", storeId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
