import status from 'http-status';
import { prisma } from '../../config/db.js';
import { AppError } from '../../errors/AppError.js';
import { UserRole } from '../../generated/prisma/index.js';
import { auth } from '../../config/auth.js';
import { sendEmail } from '../../utils/sendEmail.js';
import { env } from '../../config/env.js';

/**
 * Generates a 6-digit verification OTP, persists it, and sends it to the user's email.
 */
const generateAndSendOTP = async (email: string, name: string) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Delete previous verification tokens for this user
  await prisma.verification.deleteMany({
    where: { identifier: `otp:${email}` },
  });

  // Create new verification token
  await prisma.verification.create({
    data: {
      identifier: `otp:${email}`,
      value: otp,
      expiresAt,
    },
  });

  // Send verification email
  await sendEmail(email, 'Verify your RatedDocs email address', 'verify-otp', {
    name,
    otp,
  });
};

/**
 * Verifies if user exists, matches allowed roles, is active, and is email-verified.
 * Automatically sends a new OTP and blocks sign-in if the email is not verified.
 */
export const verifyUserRoleAndGet = async (email: string, allowedRoles: UserRole[]) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Invalid email or password', 'email');
  }

  if (user.status === 'BLOCKED') {
    throw new AppError(status.FORBIDDEN, 'Your account has been blocked', 'status');
  }

  if (user.isDeleted || user.status === 'DELETED') {
    throw new AppError(status.FORBIDDEN, 'Your account has been deleted', 'status');
  }

  if (!allowedRoles.includes(user.role as UserRole)) {
    throw new AppError(status.FORBIDDEN, 'Unauthorized role for this login portal', 'role');
  }

  // Prevent logins if the email is not verified
  if (!user.emailVerified) {
    await generateAndSendOTP(user.email, user.firstName || user.name || 'there');
    throw new AppError(
      status.FORBIDDEN,
      'Email is not verified. A verification OTP has been sent to your email.',
      'email'
    );
  }

  return user;
};

/**
 * Registers a new patient, calling Better-Auth internally, and sends a verification OTP.
 */
export const registerPatient = async (
  email: string,
  password: string,
  headers: Headers
) => {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { patient: true },
  });

  if (existingUser) {
    if (existingUser.emailVerified) {
      throw new AppError(status.CONFLICT, 'User with this email already exists', 'email');
    }
    // Delete the unverified user to allow clean re-registration
    await prisma.user.delete({
      where: { id: existingUser.id },
    });
  }

  const name = email.split('@')[0];

  // Call Better-Auth signUpEmail to hash password and register user
  await auth.api.signUpEmail({
    body: {
      email,
      password,
      name,
    },
    headers,
  });

  // Generate and send the verification OTP
  await generateAndSendOTP(email, name);
};

/**
 * Validates the email OTP, activates the user, creates their patient profile, and sends welcome email.
 */
export const verifyEmailOtp = async (email: string, otp: string) => {
  // Find the latest OTP verification record
  const verification = await prisma.verification.findFirst({
    where: {
      identifier: `otp:${email}`,
      value: otp,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!verification) {
    throw new AppError(status.BAD_REQUEST, 'Invalid OTP', 'otp');
  }

  if (verification.expiresAt < new Date()) {
    throw new AppError(status.BAD_REQUEST, 'OTP has expired', 'otp');
  }

  // Get corresponding user
  const user = await prisma.user.findUnique({
    where: { email },
    include: { patient: true },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, 'User not found', 'email');
  }

  // Execute status update and profile creation inside transaction
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verifiedAt: new Date(),
        status: 'ACTIVE',
      },
    });

    if (!user.patient) {
      await tx.patient.create({
        data: {
          userId: user.id,
        },
      });
    }

    // Clean up OTP token
    await tx.verification.deleteMany({
      where: { identifier: `otp:${email}` },
    });
  });

  // Send welcome email
  const name = user.firstName || user.name || email.split('@')[0];
  await sendEmail(email, 'Welcome to RatedDocs!', 'welcome', {
    name,
    dashboardUrl: `${env.FRONTEND_URL}/dashboard`,
  });
};
