// Đăng ký webhook Telegram: APP_URL=https://xxx.vercel.app npm run telegram:webhook
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

if (!token || !secret || !appUrl) {
  console.error("Thiếu TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET hoặc APP_URL");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message"],
  }),
});
console.log(await res.json());
