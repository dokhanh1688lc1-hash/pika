/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // exceljs dùng cho xuất Excel, chạy ở server nên không đóng gói vào bundle
  serverExternalPackages: ["exceljs"],
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: false },
  // Cho phép tải ảnh sản phẩm qua server action (ảnh đã nén ở trình duyệt, tối đa 2MB)
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
