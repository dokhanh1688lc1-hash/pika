"use client";

import { useActionState } from "react";
import type { ImportResult } from "@/lib/import-result";

export function ExcelImportForm({
  action, children, button = "Nhập từ Excel",
}: {
  action: (prev: ImportResult | null, form: FormData) => Promise<ImportResult>;
  children?: React.ReactNode;
  button?: string;
}) {
  const [res, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="card space-y-4">
      <input
        type="file" name="file" required accept=".xlsx"
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700"
      />
      {children}
      <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
        {pending ? "Đang xử lý..." : button}
      </button>
      {res && (
        <div className={`rounded-lg p-3 text-sm ${res.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          <p className="font-medium">{res.message}</p>
          {res.errors.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {res.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
