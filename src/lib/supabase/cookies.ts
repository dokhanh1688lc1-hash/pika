/** Kiểu cookie mà @supabase/ssr yêu cầu ghi lại vào phản hồi. */
export type CookieToSet = {
  name: string;
  value: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: any;
};

/** Cookie đánh dấu "không ghi nhớ": phiên đăng nhập chỉ sống đến khi đóng trình duyệt. */
export const SESSION_ONLY_COOKIE = "pika-session-only";

/** Bỏ thời hạn của cookie để nó thành cookie phiên (hết khi đóng trình duyệt). */
export function toSessionCookie(options?: CookieToSet["options"]): CookieToSet["options"] {
  if (!options) return options;
  const { maxAge: _m, expires: _e, ...rest } = options as Record<string, unknown>;
  return rest;
}
