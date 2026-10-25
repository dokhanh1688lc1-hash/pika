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

const API = "https://generativelanguage.googleapis.com/v1beta";
let discovered: string | null = null;

/**
 * Tên model Gemini đổi/ngừng theo thời gian, nên nếu không đặt GEMINI_MODEL thì hỏi Google
 * danh sách model đang có và chọn bản "flash" ổn định, số phiên bản cao nhất, có hỗ trợ generateContent.
 */
async function discoverModel(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/models?pageSize=200`, {
      headers: { "x-goog-api-key": env.geminiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const names = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
    const stable = names.filter(
      (n) => /^gemini-[\d.]+-flash$/.test(n) || n === "gemini-flash-latest",
    );
    const version = (n: string) => Number(/^gemini-([\d.]+)-flash$/.exec(n)?.[1] ?? 0);
    stable.sort((a, b) => version(b) - version(a));
    return (
      stable[0] ??
      names.find((n) => /flash/.test(n) && !/(lite|preview|exp|image|tts|live|audio|thinking)/.test(n)) ??
      names.find((n) => /flash/.test(n)) ??
      null
    );
  } catch {
    return null;
  }
}

export async function askGemini(question: string, storeId?: string): Promise<string> {
  const contents: Content[] = [{ role: "user", parts: [{ text: question }] }];
  let model = env.geminiModel || discovered || (discovered = await discoverModel());
  if (!model) return "Không lấy được danh sách model Gemini. Kiểm tra GEMINI_API_KEY hoặc đặt biến GEMINI_MODEL.";
  let retriedDiscovery = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    let res: Response;
    try {
      res = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
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
      if (res.status === 404 && !retriedDiscovery) {
        // Model cũ đã ngừng: dò lại model đang hoạt động rồi thử lần nữa
        retriedDiscovery = true;
        discovered = await discoverModel();
        if (discovered && discovered !== model) {
          model = discovered;
          step--;
          continue;
        }
      }
      if (res.status === 404) return `Không tìm thấy model "${model}". Đặt biến GEMINI_MODEL thành một model còn hoạt động (xem trong Google AI Studio).`;
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
