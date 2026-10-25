import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beauty AI Manager",
  description: "Quản lý bán hàng, kho, khách hàng, lịch hẹn cho ngành làm đẹp — tích hợp Telegram Bot và AI Agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
