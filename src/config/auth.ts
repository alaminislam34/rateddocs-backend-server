import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db.js';
import { env } from './env.js';
import { sendEmail } from '../utils/sendEmail.js';
import { EmailCallbackData } from '../modules/auth/auth.interface.js';
import { UserRole, UserStatus } from '../generated/prisma/index.js';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
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

  emailVerification: {
    sendOnSignUp: true,
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
  },

  user: {
    additionalFields: {
      firstName: { type: 'string', required: false },
      lastName: { type: 'string', required: false },
      role: { type: 'string', required: false, defaultValue: UserRole.PATIENT },
      status: { type: 'string', required: false, defaultValue: UserStatus.ACTIVE },
      gender: { type: 'string', required: false },
      isDeleted: { type: 'boolean', required: false, defaultValue: false },
      deletedAt: { type: 'date', required: false },
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectURI: 'http://localhost:5000/api/v1/auth/login/callback/google',
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
});
