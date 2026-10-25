import { env } from "@/lib/env";
import { SYSTEM_PROMPT } from "./prompt";
import { agentTools, runTool } from "./tools";

/**
 * AI Agent chạy bằng Google Gemini (có gói miễn phí) qua REST, dùng cùng bộ công cụ chỉ-đọc với bản Anthropic.
 * Không cần thêm thư viện.
 */

const MAX_STEPS = 6;

interface Part {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
  [k: string]: unknown;
}
interface Content { role: "user" | "model"; parts: Part[] }

type Schema = { type?: string; properties?: Record<string, Schema>; required?: string[]; description?: string };

/** Đổi schema kiểu Anthropic (JSON Schema) sang kiểu Gemini (kiểu viết HOA). */
function toGeminiSchema(s: Schema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: String(s.type ?? "object").toUpperCase() };
  if (s.description) out.description = s.description;
  if (s.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
  }
  if (s.required?.length) out.required = s.required;
  return out;
}

const declarations = agentTools.map((t) => {
  const schema = t.input_schema as unknown as Schema;
  const hasParams = schema.properties && Object.keys(schema.properties).length > 0;
  return {
    name: t.name,
    description: t.description ?? "",
    // Gemini không chấp nhận object rỗng: công cụ không có tham số thì bỏ `parameters`
    ...(hasParams ? { parameters: toGeminiSchema(schema) } : {}),
  };
});

export async function askGemini(question: string, storeId?: string): Promise<string> {
  const contents: Content[] = [{ role: "user", parts: [{ text: question }] }];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent`;

  for (let step = 0; step < MAX_STEPS; step++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": env.geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          tools: [{ functionDeclarations: declarations }],
          generationConfig: { maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      return "Không kết nối được Gemini (quá thời gian chờ). Bạn thử lại nhé.";
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("gemini error", res.status, detail.slice(0, 500));
      if (res.status === 429) return "Gói miễn phí của Gemini đang hết lượt trong phút/ngày này. Bạn thử lại sau ít phút nhé.";
      if (res.status === 400 && /API key/i.test(detail)) return "Khoá GEMINI_API_KEY không hợp lệ. Hãy tạo khoá mới ở Google AI Studio.";
      if (res.status === 403) return "Khoá Gemini không có quyền dùng model này (kiểm tra GEMINI_API_KEY / GEMINI_MODEL).";
      if (res.status === 404) return `Không tìm thấy model "${env.geminiModel}". Đặt biến GEMINI_MODEL thành một model còn hoạt động (xem trong Google AI Studio).`;
      return `Gemini báo lỗi ${res.status}. Xem Vercel → Logs để biết chi tiết.`;
    }

    const data = (await res.json()) as {
      candidates?: { content?: Content; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    const content = data.candidates?.[0]?.content;
    if (!content?.parts?.length) {
      return data.promptFeedback?.blockReason
        ? "Gemini từ chối trả lời câu hỏi này. Bạn thử diễn đạt khác nhé."
        : "Gemini không trả về nội dung. Bạn thử lại nhé.";
    }

    const calls = content.parts.filter((p) => p.functionCall);
    if (calls.length === 0) {
      return content.parts.map((p) => p.text ?? "").join("").trim() || "Không có câu trả lời.";
    }

    // Giữ nguyên toàn bộ lượt của model (kể cả dữ liệu suy luận) rồi trả kết quả công cụ
    contents.push({ role: "model", parts: content.parts });
    const results: Part[] = [];
    for (const p of calls) {
      const call = p.functionCall!;
      let response: unknown;
      try {
        response = { result: await runTool(call.name, call.args ?? {}, storeId) };
      } catch (e) {
        response = { error: e instanceof Error ? e.message : "Lỗi không xác định" };
      }
      results.push({ functionResponse: { name: call.name, response } });
    }
    contents.push({ role: "user", parts: results });
  }
  return "Không thể hoàn tất yêu cầu sau nhiều bước. Vui lòng thử lại với câu hỏi cụ thể hơn.";
}
