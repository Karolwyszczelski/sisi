import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';

let _supabaseBrowser: ReturnType<typeof createBrowserSupabaseClient> | null = null;

export const supabaseBrowser = new Proxy({} as ReturnType<typeof createBrowserSupabaseClient>, {
  get(_, prop) {
    if (!_supabaseBrowser) _supabaseBrowser = createBrowserSupabaseClient();
    return (_supabaseBrowser as any)[prop];
  },
});
