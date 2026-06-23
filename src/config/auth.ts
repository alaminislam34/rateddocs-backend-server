import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db.js';
import { env } from './env.js';
import { sendEmail } from '../utils/sendEmail.js';

interface EmailCallbackUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

interface EmailCallbackData {
  user: EmailCallbackUser;
  url: string;
  token: string;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendVerificationEmail: async (data: EmailCallbackData) => {
      const { user, url } = data;
      const name = user.firstName || user.name || 'there';
      await sendEmail(
        user.email,
        'Verify your RatedDocs email address',
        'verify-email',
        {
          name,
          verificationUrl: url,
        }
      );
    },
    sendResetPassword: async (data: EmailCallbackData) => {
      const { user, url } = data;
      const name = user.firstName || user.name || 'there';
      await sendEmail(
        user.email,
        'Reset your RatedDocs password',
        'reset-password',
        {
          name,
          resetUrl: url,
        }
      );
    },
  },
  user: {
    additionalFields: {
      firstName: { type: 'string', required: false },
      lastName: { type: 'string', required: false },
      role: { type: 'string', required: false, defaultValue: 'PATIENT' },
      status: { type: 'string', required: false, defaultValue: 'ACTIVE' },
      gender: { type: 'string', required: false },
      isDeleted: { type: 'boolean', required: false, defaultValue: false },
      deletedAt: { type: 'date', required: false },
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
});
