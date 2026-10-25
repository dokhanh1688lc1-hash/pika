import { askAgent } from "@/lib/ai/agent";
import { dashboardStats, lowStockProducts } from "@/lib/data/repo";
import { env, isSupabaseConfigured } from "@/lib/env";
import { vnd } from "@/lib/format";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "./api";

export interface TelegramUpdate {
  message?: { chat: { id: number }; text?: string; from?: { id: number } };
}

/** Chat được phép dùng bot: có trong telegram_links (DB) hoặc TELEGRAM_ALLOWED_CHAT_IDS. */
async function isAuthorized(chatId: number): Promise<boolean> {
  if (env.telegramAllowedChats.includes(String(chatId))) return true;
  if (!isSupabaseConfigured()) return false;
  const { data } = await getAdminClient()
    .from("telegram_links").select("id").eq("chat_id", chatId).eq("active", true).maybeSingle();
  return Boolean(data);
}

/** /start <mã> — liên kết chat với tài khoản nhân viên bằng mã dùng một lần tạo trong web app. */
async function linkChat(chatId: number, code: string): Promise<string> {
  if (!isSupabaseConfigured()) return "Hệ thống chưa cấu hình cơ sở dữ liệu.";
  const db = getAdminClient();
  const { data } = await db
    .from("telegram_links").select("id").eq("link_code", code).eq("active", false).maybeSingle();
  if (!data) return "Mã liên kết không hợp lệ hoặc đã dùng.";
  await db.from("telegram_links")
    .update({ chat_id: chatId, active: true, link_code: null }).eq("id", data.id);
  return "Liên kết thành công. Gõ /help để xem lệnh.";
}

const HELP = `Lệnh khả dụng:
/doanhthu — doanh thu hôm nay
/tonkho — sản phẩm sắp hết hàng
/help — trợ giúp
Hoặc nhắn tự nhiên, ví dụ: "khách Lan còn bao nhiêu điểm?"`;

export async function handleUpdate(update: TelegramUpdate) {
  const msg = update.message;
  if (!msg?.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text.startsWith("/start")) {
    const code = text.split(/\s+/)[1];
    return sendTelegramMessage(chatId, code ? await linkChat(chatId, code) : HELP);
  }

  if (!(await isAuthorized(chatId))) {
    return sendTelegramMessage(
      chatId,
      `Chat này chưa được liên kết (id: ${chatId}). Hãy tạo mã liên kết trong web app rồi gửi /start <mã>.`,
    );
  }

  if (text === "/help") return sendTelegramMessage(chatId, HELP);

  if (text === "/doanhthu") {
    const s = await dashboardStats();
    return sendTelegramMessage(
      chatId,
      `Hôm nay: ${vnd(s.todayRevenue)} • ${s.todayOrders} đơn • ${s.newCustomers} khách mới`,
    );
  }

  if (text === "/tonkho") {
    const low = await lowStockProducts();
    return sendTelegramMessage(
      chatId,
      low.length
        ? low.map((p) => `• ${p.name}: còn ${p.stock} (tối thiểu ${p.minStock})`).join("\n")
        : "Không có sản phẩm nào sắp hết hàng.",
    );
  }

  return sendTelegramMessage(chatId, await askAgent(text));
}
