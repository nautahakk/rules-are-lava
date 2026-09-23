import { z } from 'zod';

const serverEnvSchema = z.object({
  TYPESAFE_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1)
});

export function serverEnv() {
  return serverEnvSchema.parse(process.env);
}
