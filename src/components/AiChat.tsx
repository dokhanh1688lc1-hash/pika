"use client";

import { Send } from "lucide-react";
import { useState } from "react";

interface Msg { role: "user" | "assistant"; text: string }

export function AiChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "assistant", text: data.reply ?? data.error ?? "Có lỗi xảy ra" }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Không kết nối được máy chủ." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex h-[60vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {msgs.length === 0 && (
          <p className="text-sm text-slate-400">Ví dụ: “Doanh thu hôm nay bao nhiêu?”, “Sản phẩm nào sắp hết hàng?”</p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
            m.role === "user" ? "ml-auto bg-brand-600 text-white" : "bg-slate-100"
          }`}>{m.text}</div>
        ))}
        {busy && <p className="text-sm text-slate-400">Đang xử lý…</p>}
      </div>
      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập câu hỏi…"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-400"
        />
        <button className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white disabled:opacity-50" disabled={busy}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
