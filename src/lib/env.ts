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
  // Phương án miễn phí: Google Gemini (khoá lấy ở https://aistudio.google.com/apikey)
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  // Để trống = tự dò model Gemini (flash) còn hoạt động
  geminiModel: process.env.GEMINI_MODEL ?? "",
  // Phương án miễn phí khác: mọi dịch vụ tương thích OpenAI (Groq, OpenRouter, Mistral...)
  aiCompatKey: process.env.AI_API_KEY ?? "",
  aiCompatBaseUrl: (process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1").replace(/\/$/, ""),
  aiCompatModel: process.env.AI_COMPAT_MODEL ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  expiryAlertDays: Math.max(1, Number(process.env.EXPIRY_ALERT_DAYS) || 30),
};

export const isSupabaseConfigured = () =>
  Boolean(env.supabaseUrl && env.supabaseServiceKey);

/** Có ít nhất một nhà cung cấp AI được cấu hình (Anthropic hoặc Gemini). */
export const isAiConfigured = () => Boolean(env.anthropicKey || env.geminiKey || env.aiCompatKey);
