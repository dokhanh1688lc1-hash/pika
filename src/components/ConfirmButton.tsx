"use client";

import type { ReactNode } from "react";

/** Form có hộp xác nhận trước khi gửi. Dùng cho thao tác xoá. */
export function ConfirmForm({
  action, message, children, hidden,
}: {
  action: (form: FormData) => void | Promise<void>;
  message: string;
  children: ReactNode;
  hidden: Record<string, string>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
    </form>
  );
}
