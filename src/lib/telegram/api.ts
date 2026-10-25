import { env } from "@/lib/env";

export async function sendTelegramMessage(chatId: number | string, text: string) {
  if (!env.telegramToken) return;
  // Telegram giới hạn 4096 ký tự/tin nhắn
  const chunks = text.match(/[\s\S]{1,4000}/g) ?? [""];
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${env.telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
  }
}
