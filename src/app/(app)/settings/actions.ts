"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { getMembership } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { isValidSecret, tgCall } from "@/lib/telegram/admin";
import { COMMAND_MENU } from "@/lib/telegram/commands";
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

/** Địa chỉ gốc của trang web đang mở (vd https://pika-beauty.vercel.app). */
async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

/** Đăng ký webhook Telegram trỏ về chính website này, dùng token và secret đã đặt trên Vercel. */
export async function registerTelegramWebhook() {
  await requireMember("settings.manage", "/settings");
  if (!env.telegramToken) return redirectMsg("/settings", "error", "Chưa có biến TELEGRAM_BOT_TOKEN trên Vercel.");
  if (!env.telegramSecret) return redirectMsg("/settings", "error", "Chưa có biến TELEGRAM_WEBHOOK_SECRET trên Vercel.");
  if (!isValidSecret(env.telegramSecret)) {
    return redirectMsg("/settings", "error", "TELEGRAM_WEBHOOK_SECRET chỉ được gồm chữ, số, gạch dưới (_) và gạch ngang (-). Hãy đổi lại trên Vercel rồi Redeploy.");
  }
  const origin = await appOrigin();
  if (!origin.startsWith("https://")) return redirectMsg("/settings", "error", "Telegram chỉ nhận địa chỉ https. Hãy mở trang này từ địa chỉ Vercel.");

  const url = `${origin}/api/telegram/webhook`;
  const r = await tgCall("setWebhook", {
    url, secret_token: env.telegramSecret, allowed_updates: ["message"], drop_pending_updates: true,
  });
  if (!r.ok) return redirectMsg("/settings", "error", `Telegram từ chối: ${r.error}`);
  // Menu lệnh (nút "/" trong Telegram); lỗi ở bước này không làm hỏng việc đăng ký webhook
  await tgCall("setMyCommands", { commands: COMMAND_MENU });
  revalidatePath("/settings");
  return redirectMsg("/settings", "ok", `Đã đăng ký webhook và menu lệnh: ${url}`);
}

export async function removeTelegramWebhook() {
  await requireMember("settings.manage", "/settings");
  const r = await tgCall("deleteWebhook", { drop_pending_updates: true });
  if (!r.ok) return redirectMsg("/settings", "error", `Telegram từ chối: ${r.error}`);
  revalidatePath("/settings");
  return redirectMsg("/settings", "ok", "Đã gỡ webhook.");
}

/** Gửi một tin thử tới chat Telegram đã liên kết với tài khoản của bạn. */
export async function sendTelegramTest() {
  const m = await requireMember("settings.manage", "/settings");
  const { data } = await getAdminClient()
    .from("telegram_links").select("chat_id").eq("staff_id", m.staffId).eq("active", true).not("chat_id", "is", null).limit(1).maybeSingle();
  if (!data?.chat_id) return redirectMsg("/settings", "error", "Bạn chưa liên kết Telegram: tạo mã liên kết rồi nhắn /start <mã> cho bot.");
  const r = await tgCall("sendMessage", { chat_id: data.chat_id, text: "Tin nhắn thử từ PiKa Store: bot đã kết nối thành công." });
  if (!r.ok) return redirectMsg("/settings", "error", `Gửi không được: ${r.error}`);
  return redirectMsg("/settings", "ok", "Đã gửi tin thử, kiểm tra Telegram của bạn.");
}
