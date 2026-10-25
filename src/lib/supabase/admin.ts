import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Client service-role — CHỈ dùng phía server (webhook, AI Agent). Bỏ qua RLS. */
export function getAdminClient(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error("Supabase chưa được cấu hình");
  }
  client ??= createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false },
  });
  return client;
}
