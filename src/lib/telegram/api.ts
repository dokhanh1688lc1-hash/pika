import { env } from "@/lib/env";

export async function sendTelegramMessage(chatId: number | string, text: string) {
  if (!env.telegramToken) {
    console.error("telegram: thiếu TELEGRAM_BOT_TOKEN, không gửi được tin");
    return;
  }
  // Telegram giới hạn 4096 ký tự/tin nhắn
  const chunks = text.match(/[\s\S]{1,4000}/g) ?? [""];
  for (const chunk of chunks) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk }),
      });
      if (!res.ok) console.error("telegram: sendMessage lỗi", res.status, await res.text());
    } catch (e) {
      console.error("telegram: sendMessage không kết nối được", e);
    }
  }
}

/** Hiện "đang nhập…" trong lúc chờ AI trả lời. */
export async function sendTyping(chatId: number | string) {
  if (!env.telegramToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.telegramToken}/sendChatAction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    });
  } catch {
    /* không quan trọng */
  }
}
