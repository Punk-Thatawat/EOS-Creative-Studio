import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  FAL_KEY: z.string().min(1).optional(),
  FAL_WEBHOOK_SECRET: z.string().min(1).optional(),
  STORAGE_PROVIDER: z.enum(["supabase", "r2"]).default("supabase"),
  STORAGE_BUCKET: z.string().min(1).default("eos-assets"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse(process.env);
}
