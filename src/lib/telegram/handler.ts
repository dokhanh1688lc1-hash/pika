import { askAgent } from "@/lib/ai/agent";
import { dashboardStats, listExpiring, lowStockProducts } from "@/lib/data/repo";
import { env, isSupabaseConfigured } from "@/lib/env";
import { formatExpiryMessage } from "@/lib/expiry";
import { vnd } from "@/lib/format";
import { can, type Role } from "@/lib/rbac";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendTelegramMessage, sendTyping } from "./api";

export interface TelegramUpdate {
  message?: { chat: { id: number }; text?: string; from?: { id: number } };
}

interface Actor {
  storeId?: string; // undefined = chế độ demo
  role: Role;
}

/**
 * Xác định người gửi:
 * - Chat đã liên kết nhân viên (telegram_links) -> cửa hàng + vai trò của nhân viên đó.
 * - Chat nằm trong TELEGRAM_ALLOWED_CHAT_IDS -> coi như chủ cửa hàng, dùng DEFAULT_STORE_ID.
 */
async function resolveActor(chatId: number): Promise<Actor | null> {
  if (isSupabaseConfigured()) {
    const db = getAdminClient();
    const { data: link } = await db
      .from("telegram_links").select("store_id, staff_id")
      .eq("chat_id", chatId).eq("active", true).maybeSingle();
    if (link) {
      const { data: staff } = await db
        .from("staff").select("role, active").eq("id", link.staff_id).maybeSingle();
      if (!staff?.active) return null;
      return { storeId: link.store_id, role: staff.role as Role };
    }
  }
  if (env.telegramAllowedChats.includes(String(chatId))) {
    return {
      storeId: isSupabaseConfigured() ? process.env.DEFAULT_STORE_ID || undefined : undefined,
      role: "owner",
    };
  }
  return null;
}

/** /start <mã> — liên kết chat với tài khoản nhân viên bằng mã dùng một lần tạo trong web app. */
async function linkChat(chatId: number, code: string): Promise<string> {
  if (!isSupabaseConfigured()) return "Hệ thống chưa cấu hình cơ sở dữ liệu.";
  const db = getAdminClient();
  const { data } = await db
    .from("telegram_links").select("id, staff_id").eq("link_code", code).eq("active", false).maybeSingle();
  if (!data) return "Mã liên kết không hợp lệ hoặc đã dùng. Tạo mã mới ở Cài đặt trên web.";

  // Một chat chỉ gắn với một tài khoản: gỡ liên kết cũ của chat này (nếu có) trước khi gắn mới
  await db.from("telegram_links").delete().eq("chat_id", chatId).neq("id", data.id);
  const { error } = await db.from("telegram_links")
    .update({ chat_id: chatId, active: true, link_code: null }).eq("id", data.id);
  if (error) {
    console.error("telegram: liên kết lỗi", error);
    return `Không liên kết được: ${error.message}`;
  }
  return "Liên kết thành công. Gõ /help để xem lệnh.";
}

const HELP = `Lệnh khả dụng:
/doanhthu — doanh thu hôm nay
/tonkho — sản phẩm sắp hết hàng
/hethan — lô hàng hết hạn / sắp hết hạn
/id — xem mã chat của bạn
/help — trợ giúp
Hoặc nhắn tự nhiên, ví dụ: "khách Lan còn bao nhiêu điểm?"`;

const DENIED = "Bạn không có quyền dùng chức năng này.";

export async function handleUpdate(update: TelegramUpdate) {
  const msg = update.message;
  if (!msg?.text) return;
  const chatId = msg.chat.id;
  // Chuẩn hoá lệnh: "/Doanhthu@TenBot abc" -> "/doanhthu abc" (trong nhóm Telegram tự thêm @tenbot)
  let text = msg.text.trim();
  if (text.startsWith("/")) {
    const [head, ...rest] = text.split(/\s+/);
    text = [head.replace(/@\w+$/, "").toLowerCase(), ...rest].join(" ");
  }

  if (text === "/id") return sendTelegramMessage(chatId, `Mã chat của bạn: ${chatId}`);

  if (text === "/start" || text.startsWith("/start ")) {
    const code = text.split(/\s+/)[1];
    if (code) return sendTelegramMessage(chatId, await linkChat(chatId, code));
    if (await resolveActor(chatId)) return sendTelegramMessage(chatId, HELP);
    return sendTelegramMessage(
      chatId,
      `Chat này chưa được liên kết (id: ${chatId}). Tạo mã liên kết trong web app (Cài đặt) rồi gửi /start <mã>.`,
    );
  }

  const actor = await resolveActor(chatId);
  if (!actor) {
    return sendTelegramMessage(
      chatId,
      `Chat này chưa được liên kết (id: ${chatId}). Tạo mã liên kết trong web app (Cài đặt) rồi gửi /start <mã>.`,
    );
  }

  if (text === "/help") return sendTelegramMessage(chatId, HELP);

  if (text === "/doanhthu") {
    if (!can(actor.role, "reports.view")) return sendTelegramMessage(chatId, DENIED);
    const s = await dashboardStats(actor.storeId);
    return sendTelegramMessage(
      chatId,
      `Hôm nay: ${vnd(s.todayRevenue)} • ${s.todayOrders} đơn • ${s.newCustomers} khách mới`,
    );
  }

  if (text === "/tonkho") {
    if (!can(actor.role, "inventory.manage") && !can(actor.role, "reports.view")) {
      return sendTelegramMessage(chatId, DENIED);
    }
    const low = await lowStockProducts(actor.storeId);
    return sendTelegramMessage(
      chatId,
      low.length
        ? low.map((p) => `• ${p.name}: còn ${p.stock} (tối thiểu ${p.minStock})`).join("\n")
        : "Không có sản phẩm nào sắp hết hàng.",
    );
  }

  if (text === "/hethan") {
    if (!can(actor.role, "inventory.manage") && !can(actor.role, "reports.view")) {
      return sendTelegramMessage(chatId, DENIED);
    }
    const rows = await listExpiring(env.expiryAlertDays, actor.storeId);
    return sendTelegramMessage(chatId, formatExpiryMessage(rows, env.expiryAlertDays));
  }

  if (!can(actor.role, "ai.use")) return sendTelegramMessage(chatId, DENIED);
  await sendTyping(chatId);
  return sendTelegramMessage(chatId, await askAgent(text, actor.storeId));
}
