import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { agentTools, runTool } from "./tools";

const SYSTEM_PROMPT = `Bạn là trợ lý vận hành của phần mềm Beauty AI Manager cho cửa hàng/spa/salon làm đẹp.
- Trả lời bằng tiếng Việt, ngắn gọn, đúng số liệu; tiền tệ định dạng VND.
- Luôn dùng công cụ để lấy số liệu thực, không tự bịa số.
- Bạn chỉ có quyền đọc dữ liệu. Nếu được yêu cầu thay đổi dữ liệu, hãy hướng dẫn người dùng thao tác trong ứng dụng.`;

const MAX_STEPS = 6;

export async function askAgent(
  question: string,
  history: Anthropic.MessageParam[] = [],
): Promise<string> {
  if (!env.anthropicKey) {
    return "AI Agent chưa được cấu hình (thiếu ANTHROPIC_API_KEY).";
  }
  const client = new Anthropic({ apiKey: env.anthropicKey });
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: question },
  ];

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
        const out = await runTool(block.name, block.input as Record<string, unknown>);
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
