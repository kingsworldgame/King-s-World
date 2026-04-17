"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function resolvePublicKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function hasPublicSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && resolvePublicKey());
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = resolvePublicKey();
  browserClient = createClient(url, key);
  return browserClient;
}
