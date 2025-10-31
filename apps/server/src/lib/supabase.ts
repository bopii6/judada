import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../config/env";

let supabaseClient: SupabaseClient | null = null;

/**
 * 用于与 Supabase 服务通信（Storage、Auth、Edge Functions 等）。
 * 这里复用单例，避免每次请求都重新初始化。
 */
export const getSupabase = () => {
  if (!supabaseClient) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv();
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return supabaseClient;
};
