import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Server-only Supabase client using the service role key. RLS is enabled with
 * no policies, so this is the only way to reach the `games` table. Never
 * import this from a client component, and never expose the key as
 * NEXT_PUBLIC_.
 */

export type ServerSupabaseClient = SupabaseClient<Database>;

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    this.name = 'SupabaseNotConfiguredError';
  }
}

let client: ServerSupabaseClient | null = null;

function readSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null;
}

export function getSupabase(): ServerSupabaseClient {
  if (client) return client;

  const env = readSupabaseEnv();
  if (!env) throw new SupabaseNotConfiguredError();

  client = createClient<Database>(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
