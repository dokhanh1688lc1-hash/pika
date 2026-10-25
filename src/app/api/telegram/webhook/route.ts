import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendTelegramMessage } from "@/lib/telegram/api";
import { handleUpdate, type TelegramUpdate } from "@/lib/telegram/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Mở địa chỉ này bằng trình duyệt để kiểm tra route đang chạy và đã đủ biến môi trường chưa. */
export function GET() {
  return NextResponse.json({
    ok: true,
    service: "telegram-webhook",
    tokenConfigured: Boolean(env.telegramToken),
    secretConfigured: Boolean(env.telegramSecret),
  });
}

export async function POST(req: Request) {
  // Xác thực request thực sự đến từ Telegram
  if (!env.telegramSecret || req.headers.get("x-telegram-bot-api-secret-token") !== env.telegramSecret) {
    console.warn(
      "telegram webhook: bị từ chối (401) —",
      env.telegramSecret ? "secret trong header không khớp TELEGRAM_WEBHOOK_SECRET" : "chưa đặt TELEGRAM_WEBHOOK_SECRET",
    );
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleUpdate(update);
  } catch (e) {
    console.error("telegram handler error", e);
    const chatId = update.message?.chat.id;
    if (chatId) await sendTelegramMessage(chatId, "Xin lỗi, có lỗi khi xử lý yêu cầu. Bạn thử lại sau ít phút nhé.");
  }
  // Luôn trả 200 để Telegram không gửi lại update
  return NextResponse.json({ ok: true });
}
