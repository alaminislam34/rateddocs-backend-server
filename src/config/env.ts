import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string({ message: 'DATABASE_URL is required' }),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  BETTER_AUTH_SECRET: z.string({ message: 'BETTER_AUTH_SECRET is required' }).min(1),
  BETTER_AUTH_URL: z.string({ message: 'BETTER_AUTH_URL is required' }).url(),
  CLOUDINARY_CLOUD_NAME: z.string({ message: 'CLOUDINARY_CLOUD_NAME is required' }),
  CLOUDINARY_API_KEY: z.string({ message: 'CLOUDINARY_API_KEY is required' }),
  CLOUDINARY_API_SECRET: z.string({ message: 'CLOUDINARY_API_SECRET is required' }),
  SMTP_HOST: z.string({ message: 'SMTP_HOST is required' }),
  SMTP_PORT: z
    .string()
    .default('2525')
    .transform((val) => parseInt(val, 10)),
  SMTP_USER: z.string({ message: 'SMTP_USER is required' }),
  SMTP_PASS: z.string({ message: 'SMTP_PASS is required' }),
  SMTP_FROM: z.string().default('RatedDocs <noreply@rateddocs.com>'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
