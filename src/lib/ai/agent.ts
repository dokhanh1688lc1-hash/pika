import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { askGemini } from "./gemini";
import { askOpenAiCompat } from "./openai-compat";
import { SYSTEM_PROMPT } from "./prompt";
import { agentTools, runTool } from "./tools";


const MAX_STEPS = 6;

export async function askAgent(question: string, storeId?: string): Promise<string> {
  // Ưu tiên Anthropic nếu có khoá; không thì dùng Gemini (có gói miễn phí)
  if (!env.anthropicKey) {
    if (env.geminiKey) return askGemini(question, storeId);
    if (env.aiCompatKey) return askOpenAiCompat(question, storeId);
    return "AI Agent chưa được cấu hình (thiếu ANTHROPIC_API_KEY, GEMINI_API_KEY hoặc AI_API_KEY).";
  }
  const client = new Anthropic({ apiKey: env.anthropicKey });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({
      model: env.aiModel,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: agentTools,
      messages,
    });

    if (res.stop_reason !== "tool_use") {
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
    }

    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      try {
        const out = await runTool(block.name, block.input as Record<string, unknown>, storeId);
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
      } catch (e) {
        results.push({
          type: "tool_result", tool_use_id: block.id, is_error: true,
          content: e instanceof Error ? e.message : "Lỗi không xác định",
        });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return "Không thể hoàn tất yêu cầu sau nhiều bước. Vui lòng thử lại với câu hỏi cụ thể hơn.";
}
