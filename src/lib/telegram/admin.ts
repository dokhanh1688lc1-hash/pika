import { env } from "@/lib/env";

/** Gọi Telegram Bot API từ server. Token không bao giờ được trả về cho trình duyệt. */
export async function tgCall<T = unknown>(
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  if (!env.telegramToken) return { ok: false, error: "Chưa cấu hình TELEGRAM_BOT_TOKEN." };
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.telegramToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) return { ok: false, error: json.description ?? `Telegram trả lỗi ${res.status}` };
    return { ok: true, result: json.result as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không kết nối được Telegram." };
  }
}

export interface TelegramStatus {
  tokenSet: boolean;
  secretSet: boolean;
  secretValid: boolean;
  bot?: { username: string; name: string };
  tokenError?: string;
  webhook?: {
    url: string;
    pending: number;
    lastErrorMessage?: string;
    lastErrorDate?: number;
  };
}

/** Telegram chỉ nhận secret_token gồm A-Z a-z 0-9 _ - và dài 1-256 ký tự. */
export const isValidSecret = (s: string) => /^[A-Za-z0-9_-]{1,256}$/.test(s);

export async function telegramStatus(): Promise<TelegramStatus> {
  const status: TelegramStatus = {
    tokenSet: Boolean(env.telegramToken),
    secretSet: Boolean(env.telegramSecret),
    secretValid: isValidSecret(env.telegramSecret),
  };
  if (!status.tokenSet) return status;

  const me = await tgCall<{ username: string; first_name: string }>("getMe");
  if (!me.ok) {
    status.tokenError = me.error;
    return status;
  }
  status.bot = { username: me.result.username, name: me.result.first_name };

  const info = await tgCall<{
    url: string; pending_update_count: number; last_error_message?: string; last_error_date?: number;
  }>("getWebhookInfo");
  if (info.ok) {
    status.webhook = {
      url: info.result.url,
      pending: info.result.pending_update_count,
      lastErrorMessage: info.result.last_error_message,
      lastErrorDate: info.result.last_error_date,
    };
  }
  return status;
}
