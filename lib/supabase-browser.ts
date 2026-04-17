"use client";

import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, hasPublicSupabaseEnv } from "@/lib/supabase-env";

let browserClient: SupabaseClient | null = null;

export { hasPublicSupabaseEnv };

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
  return browserClient;
}
