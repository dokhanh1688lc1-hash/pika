/** Kiểu cookie mà @supabase/ssr yêu cầu ghi lại vào phản hồi. */
export type CookieToSet = {
  name: string;
  value: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: any;
};
