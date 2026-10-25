import { NextResponse } from "next/server";
import { z } from "zod";
import { askAgent } from "@/lib/ai/agent";
import { getMembership } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { can } from "@/lib/rbac";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ message: z.string().min(1).max(2000) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }

  // Chế độ demo: không có dữ liệu thật nên không cần đăng nhập
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ reply: await askAgent(parsed.data.message) });
  }

  const member = await getMembership();
  if (!member) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!can(member.role, "ai.use")) {
    return NextResponse.json({ error: "Bạn không có quyền dùng trợ lý AI" }, { status: 403 });
  }
  const reply = await askAgent(parsed.data.message, member.storeId);
  return NextResponse.json({ reply });
}
