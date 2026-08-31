import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/domain/types";
import { BRAND } from "./brand";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isDemoMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl === "" || supabaseAnonKey === "";

let _client: SupabaseClient<Database> | null = null;

function createSupabaseClient(): SupabaseClient<Database> | null {
  if (isDemoMode) return null;
  try {
    return createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn(`${BRAND.logPrefix} Supabase init failed — falling back to demo mode`, err);
    return null;
  }
}

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!_client && !isDemoMode) {
    _client = createSupabaseClient();
  }
  return _client;
}

export const supabase = getSupabaseClient();
