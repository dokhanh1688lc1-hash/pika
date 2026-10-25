/** Truy cập biến môi trường tập trung. Không throw khi thiếu để app vẫn chạy ở chế độ demo. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  telegramToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  telegramAllowedChats: (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "claude-sonnet-5-5",
};

export const isSupabaseConfigured = () =>
  Boolean(env.supabaseUrl && env.supabaseServiceKey);
