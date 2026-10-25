"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "In hoá đơn" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
    >
      <Printer size={16} /> {label}
    </button>
  );
}
