import { NextResponse } from "next/server";
import { z } from "zod";
import { askAgent } from "@/lib/ai/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ message: z.string().min(1).max(2000) });

// TODO(auth): kiểm tra phiên Supabase + quyền "ai.use" trước khi mở cho production.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const reply = await askAgent(parsed.data.message);
  return NextResponse.json({ reply });
}
