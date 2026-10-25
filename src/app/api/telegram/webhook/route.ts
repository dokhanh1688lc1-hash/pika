import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { handleUpdate, type TelegramUpdate } from "@/lib/telegram/handler";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Xác thực request thực sự đến từ Telegram
  if (!env.telegramSecret || req.headers.get("x-telegram-bot-api-secret-token") !== env.telegramSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json()) as TelegramUpdate;
  try {
    await handleUpdate(update);
  } catch (e) {
    console.error("telegram handler error", e);
  }
  // Luôn trả 200 để Telegram không gửi lại update
  return NextResponse.json({ ok: true });
}
