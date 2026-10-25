"use client";

import { useEffect } from "react";

/** Mở hộp thoại in sau khi trang (và ảnh QR) tải xong. */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, []);
  return null;
}
