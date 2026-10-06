import { afterEach, describe, expect, it, vi } from 'vitest';

describe('lib/supabase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('throws a typed error when env vars are missing', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const { getSupabase, isSupabaseConfigured, SupabaseNotConfiguredError } =
      await import('@/lib/supabase');

    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getSupabase()).toThrow(SupabaseNotConfiguredError);
  });

  it('creates and reuses a single client when configured', async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
    const { getSupabase, isSupabaseConfigured } = await import('@/lib/supabase');

    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabase()).toBe(getSupabase());
  });
});
