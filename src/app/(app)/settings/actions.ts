"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { getMembership } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

/** Tạo mã liên kết Telegram dùng một lần cho nhân viên đang đăng nhập. */
export async function createTelegramLinkCode() {
  const member = await getMembership();
  if (!member) redirect("/login");
  const code = randomBytes(6).toString("hex"); // 12 ký tự
  const { error } = await getAdminClient().from("telegram_links").insert({
    store_id: member.storeId,
    staff_id: member.staffId,
    link_code: code,
    active: false,
  });
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  redirect(`/settings?code=${code}`);
}
