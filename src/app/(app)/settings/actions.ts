"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { getMembership } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirectMsg, requireMember } from "@/lib/guard";
import { toText } from "@/lib/parse";
import { BANKS } from "@/lib/vietqr";
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

/** Lưu thông tin cửa hàng (in trên hoá đơn) và tài khoản ngân hàng nhận tiền (mã QR). */
export async function saveStoreInfo(form: FormData) {
  const m = await requireMember("settings.manage", "/settings");
  const name = toText(form.get("name"));
  const bankCode = toText(form.get("bankCode"));
  const account = toText(form.get("bankAccount")).replace(/\s/g, "");
  const holder = toText(form.get("bankHolder")).toUpperCase();
  if (!name) return redirectMsg("/settings", "error", "Nhập tên cửa hàng.");
  if (bankCode && !BANKS.some((b) => b.code === bankCode)) return redirectMsg("/settings", "error", "Ngân hàng không hợp lệ.");
  if (account && !/^[0-9A-Za-z]{4,25}$/.test(account)) return redirectMsg("/settings", "error", "Số tài khoản không hợp lệ.");
  if ((bankCode && !account) || (!bankCode && account)) {
    return redirectMsg("/settings", "error", "Nhập đủ cả ngân hàng và số tài khoản để hiện mã QR.");
  }
  const { error } = await getAdminClient().from("stores").update({
    name, phone: toText(form.get("phone")) || null, address: toText(form.get("address")) || null,
    bank_code: bankCode || null, bank_account: account || null, bank_holder: holder || null,
  }).eq("id", m.storeId);
  if (error) return redirectMsg("/settings", "error", `Không lưu được: ${error.message}`);
  revalidatePath("/settings");
  revalidatePath("/pos");
  return redirectMsg("/settings", "ok", "Đã lưu thông tin cửa hàng.");
}
