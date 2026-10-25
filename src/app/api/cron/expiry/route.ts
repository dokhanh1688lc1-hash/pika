import { NextResponse } from "next/server";
import type { BatchRow } from "@/lib/data/types";
import { env, isSupabaseConfigured } from "@/lib/env";
import { formatExpiryMessage } from "@/lib/expiry";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "@/lib/telegram/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Chỉ những người quản lý kho/cửa hàng mới nhận cảnh báo
const NOTIFY_ROLES = ["owner", "manager", "stock_keeper"];

/**
 * Vercel Cron gọi mỗi ngày (xem vercel.json) kèm header `Authorization: Bearer <CRON_SECRET>`.
 * Gửi tin cảnh báo hạn sử dụng tới các chat Telegram đã liên kết của từng cửa hàng.
 */
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, skipped: "no database" });

  const db = getAdminClient();
  const { data, error } = await db
    .from("v_batches")
    .select("store_id, id, sku, product, batch_code, quantity, expiry_date, days_left")
    .lte("days_left", env.expiryAlertDays)
    .order("expiry_date");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const byStore = new Map<string, BatchRow[]>();
  for (const r of data ?? []) {
    const list = byStore.get(r.store_id) ?? [];
    list.push({
      id: r.id, sku: r.sku, product: r.product, batchCode: r.batch_code ?? "",
      quantity: Number(r.quantity), expiryDate: String(r.expiry_date), daysLeft: Number(r.days_left),
    });
    byStore.set(r.store_id, list);
  }
  if (byStore.size === 0) return NextResponse.json({ ok: true, stores: 0, sent: 0 });

  const storeIds = [...byStore.keys()];
  const { data: links } = await db
    .from("telegram_links")
    .select("store_id, staff_id, chat_id")
    .in("store_id", storeIds)
    .eq("active", true)
    .not("chat_id", "is", null);
  const staffIds = [...new Set((links ?? []).map((l) => l.staff_id))];
  const { data: staff } = staffIds.length
    ? await db.from("staff").select("id, role, active").in("id", staffIds)
    : { data: [] as { id: string; role: string; active: boolean }[] };
  const allowed = new Set((staff ?? []).filter((s) => s.active && NOTIFY_ROLES.includes(s.role)).map((s) => s.id));

  const recipients = new Map<string, Set<string>>();
  for (const l of links ?? []) {
    if (!allowed.has(l.staff_id)) continue;
    const set = recipients.get(l.store_id) ?? new Set<string>();
    set.add(String(l.chat_id));
    recipients.set(l.store_id, set);
  }
  // Chat trong TELEGRAM_ALLOWED_CHAT_IDS nhận cảnh báo của cửa hàng mặc định
  const defaultStore = process.env.DEFAULT_STORE_ID;
  if (defaultStore && byStore.has(defaultStore)) {
    const set = recipients.get(defaultStore) ?? new Set<string>();
    env.telegramAllowedChats.forEach((c) => set.add(c));
    recipients.set(defaultStore, set);
  }

  let sent = 0;
  for (const [storeId, rows] of byStore) {
    const text = `Cảnh báo hạn sử dụng\n\n${formatExpiryMessage(rows, env.expiryAlertDays)}`;
    for (const chat of recipients.get(storeId) ?? []) {
      try {
        await sendTelegramMessage(chat, text);
        sent++;
      } catch (e) {
        console.error("cron expiry: gửi thất bại", chat, e);
      }
    }
  }
  return NextResponse.json({ ok: true, stores: byStore.size, sent });
}
