"use server";

import { redirect } from "next/navigation";
import { getAuthUser, getMembership } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

/** Tạo cửa hàng đầu tiên + chi nhánh mặc định + hồ sơ chủ cửa hàng cho người dùng đang đăng nhập. */
export async function createStore(form: FormData) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (await getMembership()) redirect("/dashboard");

  const storeName = String(form.get("storeName") ?? "").trim();
  const ownerName = String(form.get("ownerName") ?? "").trim();
  if (!storeName || !ownerName) {
    redirect(`/onboarding?error=${encodeURIComponent("Vui lòng nhập đủ thông tin")}`);
  }

  const db = getAdminClient();
  const { data: store, error: e1 } = await db
    .from("stores").insert({ name: storeName }).select("id").single();
  if (e1 || !store) redirect(`/onboarding?error=${encodeURIComponent("Không tạo được cửa hàng: " + (e1?.message ?? ""))}`);

  const { error: e2 } = await db.from("branches")
    .insert({ store_id: store.id, name: "Chi nhánh chính", is_default: true });
  const { error: e3 } = await db.from("staff")
    .insert({ store_id: store.id, user_id: user.id, name: ownerName, role: "owner" });
  if (e2 || e3) {
    await db.from("stores").delete().eq("id", store.id); // hoàn tác để có thể thử lại
    redirect(`/onboarding?error=${encodeURIComponent("Không tạo được hồ sơ: " + (e2?.message ?? e3?.message ?? ""))}`);
  }
  redirect("/dashboard");
}
