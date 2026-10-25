/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: false },
  // Cho phép tải ảnh sản phẩm qua server action (ảnh đã nén ở trình duyệt, tối đa 2MB)
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
