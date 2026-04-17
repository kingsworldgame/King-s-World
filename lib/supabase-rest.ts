import "server-only";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function requireSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Supabase environment is not configured. Set NEXT_PUBLIC_SUPABASE_URL and one of: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return {
    url: SUPABASE_URL.replace(/\/$/, ""),
    key: SUPABASE_KEY,
  };
}

export async function supabaseSelect<T>(table: string, params: URLSearchParams, init?: RequestInit): Promise<T[]> {
  const { url, key } = requireSupabaseEnv();
  const response = await fetch(`${url}/rest/v1/${table}?${params.toString()}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase select failed for ${table}: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<T[]>;
}

export async function supabaseUpsert<T>(table: string, payload: T | T[]): Promise<void> {
  const { url, key } = requireSupabaseEnv();
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Supabase upsert failed for ${table}: ${response.status} ${await response.text()}`);
  }
}

export function inFilter(values: string[]): string {
  return `in.(${values.map((value) => `"${value}"`).join(",")})`;
}

export function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
