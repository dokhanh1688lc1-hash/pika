import { NextResponse } from "next/server";
import { env, isAiConfigured, isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    services: {
      database: isSupabaseConfigured() ? "configured" : "demo-mode",
      telegram: env.telegramToken && env.telegramSecret ? "configured" : "missing",
      ai: isAiConfigured() ? (env.anthropicKey ? "configured (anthropic)" : "configured (gemini)") : "missing",
    },
  });
}
