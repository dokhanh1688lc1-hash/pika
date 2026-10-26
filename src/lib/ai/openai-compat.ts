import { env } from "@/lib/env";
import { SYSTEM_PROMPT } from "./prompt";
import { agentTools, runTool } from "./tools";

/**
 * AI Agent chạy bằng bất kỳ dịch vụ tương thích OpenAI (Groq, OpenRouter, Mistral, ...) qua REST.
 * Dùng cùng bộ công cụ chỉ-đọc với bản Anthropic / Gemini.
 */

const MAX_STEPS = 6;

interface ToolCall { id: string; type: "function"; function: { name: string; arguments: string } }
interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

const tools = agentTools.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description ?? "", parameters: t.input_schema },
}));

async function availableModels(): Promise<string> {
  try {
    const res = await fetch(`${env.aiCompatBaseUrl}/models`, {
      headers: { authorization: `Bearer ${env.aiCompatKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { data?: { id: string }[] };
    return (data.data ?? []).map((m) => m.id).slice(0, 25).join(", ");
  } catch {
    return "";
  }
}

export async function askOpenAiCompat(question: string, storeId?: string): Promise<string> {
  if (!env.aiCompatModel) {
    const list = await availableModels();
    return `Chưa đặt AI_COMPAT_MODEL. ${list ? `Các model đang có: ${list}. ` : ""}Chọn một model hỗ trợ gọi công cụ (tool calling) rồi đặt biến AI_COMPAT_MODEL trên Vercel.`;
  }
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: question },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    let res: Response;
    try {
      res = await fetch(`${env.aiCompatBaseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.aiCompatKey}` },
        body: JSON.stringify({ model: env.aiCompatModel, messages, tools, max_tokens: 1024 }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      return "Không kết nối được dịch vụ AI (quá thời gian chờ). Bạn thử lại nhé.";
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("ai-compat error", res.status, detail.slice(0, 500));
      if (res.status === 401) return "Khoá AI_API_KEY không hợp lệ hoặc đã bị thu hồi.";
      if (res.status === 429) return "Gói miễn phí đang hết lượt trong phút/ngày này. Bạn thử lại sau ít phút nhé.";
      if (res.status === 404 || res.status === 400) {
        const list = await availableModels();
        return `Model "${env.aiCompatModel}" không dùng được (có thể đã ngừng hoặc không hỗ trợ gọi công cụ).${list ? ` Các model đang có: ${list}.` : ""} Đổi biến AI_COMPAT_MODEL rồi Redeploy.`;
      }
      return `Dịch vụ AI báo lỗi ${res.status}. Xem Vercel → Logs để biết chi tiết.`;
    }

    const data = (await res.json()) as { choices?: { message?: Message }[] };
    const msg = data.choices?.[0]?.message;
    if (!msg) return "Dịch vụ AI không trả về nội dung. Bạn thử lại nhé.";

    if (!msg.tool_calls?.length) return (msg.content ?? "").trim() || "Không có câu trả lời.";

    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
    for (const call of msg.tool_calls) {
      let out: unknown;
      try {
        const args = call.function.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
        out = await runTool(call.function.name, args, storeId);
      } catch (e) {
        out = { error: e instanceof Error ? e.message : "Lỗi không xác định" };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out) });
    }
  }
  return "Không thể hoàn tất yêu cầu sau nhiều bước. Vui lòng thử lại với câu hỏi cụ thể hơn.";
}
