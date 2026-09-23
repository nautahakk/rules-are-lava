import { createClient } from '@supabase/supabase-js';
import { serverEnv } from './env';

export function createServiceDatabase() {
  const env = serverEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
