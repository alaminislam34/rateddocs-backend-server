import status from 'http-status';
import { prisma } from '../../config/db.js';
import { AppError } from '../../errors/AppError.js';
import { UserRole, UserStatus } from '../../generated/prisma/index.js';
import { auth } from '../../config/auth.js';
import { sendEmail } from '../../shared/sendEmail.js';
import { envVars } from '../../config/env.js';
import { LoginPayload } from './auth.interface.js';
import { IsExistUser } from '../../shared/IsExistUser.js';
import { generateAndSendOTP } from '../../shared/generateOtp.js';
import { tokenUtils } from '../../utils/token.js';

export const verifyUserRoleAndGet = async (email: string, role: UserRole[]) => {
  return await IsExistUser(email, role);
};

const registerPatient = async (
  email: string,
  password: string,
  headers: Headers,
): Promise<{ needEmailVerify?: boolean; email?: string } | void> => {
  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    if (existingUser.role !== UserRole.PATIENT) {
      throw new AppError(status.CONFLICT, 'User with this email already exists.', 'email');
    }

    if (existingUser.isDeleted) {
      throw new AppError(status.FORBIDDEN, 'User is deleted.', 'deleted');
    }

    const inactiveStatuses: UserStatus[] = [UserStatus.BLOCKED, UserStatus.SUSPENDED];
    if (inactiveStatuses.includes(existingUser.status)) {
      throw new AppError(status.FORBIDDEN, 'User account is not active.', 'status');
    }

    if (existingUser.emailVerified) {
      throw new AppError(status.CONFLICT, 'User with this email already exists.', 'email');
    }

    // Email is registered as a PATIENT but not verified.
    // Proactively generate and resend the OTP.
    try {
      const name = existingUser.firstName || existingUser.name || email.split('@')[0];
      await generateAndSendOTP(email, name);
      return;
    } catch (error: unknown) {
      throw new AppError(
        status.INTERNAL_SERVER_ERROR,
        (error as Error)?.message || 'Failed to resend verification OTP. Please try again.',
        'otp',
      );
    }
  }

  const name = email.split('@')[0];

  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
      headers,
    });
  } catch (error: unknown) {
    throw new AppError(
      status.BAD_REQUEST,
      (error as Error)?.message || 'Failed to create user account.',
      'email',
    );
  }

  try {
    await generateAndSendOTP(email, name);
  } catch (error: unknown) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      (error as Error)?.message || 'Failed to send verification OTP.',
      'otp',
    );
  }
};

const verifyEmailOtp = async (email: string, otp: string) => {
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

    if (user.role === 'PATIENT' && !user.patient) {
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
    dashboardUrl: `${envVars.FRONTEND_URL}/`,
  });

  // Create active session in Better-Auth
  const authCtx = await (
    auth as {
      $context: Promise<{
        internalAdapter: {
          createSession: (
            userId: string,
            dontRememberMe?: boolean,
            override?: Record<string, unknown>,
            overrideAll?: boolean,
          ) => Promise<{ token: string; expiresAt: Date }>;
        };
      }>;
    }
  ).$context;

  const session = await authCtx.internalAdapter.createSession(user.id);

  const accessToken = tokenUtils.getAccessToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
  });

  const refreshToken = tokenUtils.getRefreshToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
  });

  return {
    token: session.token as string,
    expiresAt: session.expiresAt as Date,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
};

const loginUser = async (payload: LoginPayload, clientHeaders?: Headers) => {
  const { email, password } = payload;

  // 1. Verify user status and allowed roles
  const user = await IsExistUser(email, [UserRole.DENTIST, UserRole.PATIENT]);

  // 2. Authenticate credentials via Better Auth
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
    headers: clientHeaders,
  });

  if (!response.ok) {
    let errorMessage = 'Invalid email or password';
    try {
      const errorBody = (await response.json()) as { message?: string; code?: string };
      errorMessage = errorBody.message || errorMessage;
    } catch {
      // Ignore JSON parsing errors
    }
    throw new AppError(response.status, errorMessage);
  }

  // If two-step verification is enabled, send OTP and return twoFactorRequired: true
  if (user.twoFactorEnabled) {
    const name = user.firstName || user.name || email.split('@')[0];
    await generateAndSendOTP(email, name, '2fa');

    return {
      twoFactorRequired: true,
      email,
    };
  }

  const data = await response.json();
  const headersList: [string, string][] = [];
  response.headers.forEach((value, key) => {
    headersList.push([key, value]);
  });

  const accessToken = tokenUtils.getAccessToken({
    userId: data.user.id,
    role: data.user.role,
    name: data.user.name,
    email: data.user.email,
    status: data.user.status,
    emailVerified: data.user.emailVerified,
  });

  const refreshToken = tokenUtils.getRefreshToken({
    userId: data.user.id,
    role: data.user.role,
    name: data.user.name,
    email: data.user.email,
    status: data.user.status,
    emailVerified: data.user.emailVerified,
  });

  return {
    twoFactorRequired: false,
    data,
    headers: headersList,
    accessToken,
    refreshToken,
  };
};

const loginAdmin = async (payload: LoginPayload, clientHeaders?: Headers) => {
  const { email, password } = payload;

  // 1. Verify user status and allowed roles
  const user = await IsExistUser(email, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);

  // 2. Authenticate credentials via Better Auth
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
    headers: clientHeaders,
  });

  if (!response.ok) {
    let errorMessage = 'Invalid email or password';
    try {
      const errorBody = (await response.json()) as { message?: string; code?: string };
      errorMessage = errorBody.message || errorMessage;
    } catch {
      // Ignore JSON parsing errors
    }
    throw new AppError(response.status, errorMessage);
  }

  // If two-step verification is enabled, send OTP and return twoFactorRequired: true
  if (user.twoFactorEnabled) {
    const name = user.firstName || user.name || email.split('@')[0];
    await generateAndSendOTP(email, name, '2fa');

    return {
      twoFactorRequired: true,
      email,
    };
  }

  const data = await response.json();
  const headersList: [string, string][] = [];
  response.headers.forEach((value, key) => {
    headersList.push([key, value]);
  });

  const accessToken = tokenUtils.getAccessToken({
    userId: data.user.id,
    role: data.user.role,
    name: data.user.name,
    email: data.user.email,
    status: data.user.status,
    emailVerified: data.user.emailVerified,
  });

  const refreshToken = tokenUtils.getRefreshToken({
    userId: data.user.id,
    role: data.user.role,
    name: data.user.name,
    email: data.user.email,
    status: data.user.status,
    emailVerified: data.user.emailVerified,
  });

  return {
    twoFactorRequired: false,
    data,
    headers: headersList,
    accessToken,
    refreshToken,
  };
};

const verify2faOtp = async (email: string, otp: string) => {
  // Find the latest 2FA OTP verification record
  const verification = await prisma.verification.findFirst({
    where: {
      identifier: `2fa:${email}`,
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

  // Clean up OTP token
  await prisma.verification.deleteMany({
    where: { identifier: `2fa:${email}` },
  });

  // Create active session in Better-Auth
  const authCtx = await (
    auth as {
      $context: Promise<{
        internalAdapter: {
          createSession: (
            userId: string,
            dontRememberMe?: boolean,
            override?: Record<string, unknown>,
            overrideAll?: boolean,
          ) => Promise<{ token: string; expiresAt: Date }>;
        };
      }>;
    }
  ).$context;

  const session = await authCtx.internalAdapter.createSession(user.id);

  const accessToken = tokenUtils.getAccessToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
  });

  const refreshToken = tokenUtils.getRefreshToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status,
    emailVerified: user.emailVerified,
  });

  return {
    token: session.token as string,
    expiresAt: session.expiresAt as Date,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
};

const initiateGoogleLogin = async (clientHeaders: Headers) => {
  const result = await auth.api.signInSocial({
    body: {
      provider: 'google',
      callbackURL: `${envVars.FRONTEND_URL}/`,
    },
    headers: clientHeaders,
    returnHeaders: true,
  });

  if (result && result.response && 'url' in result.response && result.response.url) {
    return {
      url: result.response.url,
      headers: result.headers
    };
  } else {
    throw new AppError(status.INTERNAL_SERVER_ERROR, 'Failed to initiate Google OAuth flow');
  }
};

const logout = async (clientHeaders: Headers) => {
  await auth.api.signOut({
    headers: clientHeaders,
  });
};

const resendOtp = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, 'User not found');
  }

  const name = user.firstName || user.name || email.split('@')[0];
  await generateAndSendOTP(email, name);
};

const getSession = async (
  clientHeaders: Headers,
  incomingUserAgent?: string,
  incomingIp?: string,
) => {
  const result = await auth.api.getSession({
    headers: clientHeaders,
  });

  if (!result) {
    return null;
  }

  const { session } = result;

  // 1. Verify User-Agent
  if (session.userAgent && incomingUserAgent && session.userAgent !== incomingUserAgent) {
    await prisma.session.delete({
      where: { token: session.token },
    });
    throw new AppError(
      status.UNAUTHORIZED,
      'Unauthorized: Session fingerprint mismatch (User-Agent)',
    );
  }

  // 2. Verify IP (Subnet Class C check for IPv4)
  if (session.ipAddress && incomingIp && session.ipAddress !== incomingIp) {
    const isSubnetMatch = (ip1: string, ip2: string) => {
      const parts1 = ip1.split('.');
      const parts2 = ip2.split('.');
      if (parts1.length === 4 && parts2.length === 4) {
        return parts1[0] === parts2[0] && parts1[1] === parts2[1] && parts1[2] === parts2[2];
      }
      return false;
    };

    if (!isSubnetMatch(session.ipAddress, incomingIp)) {
      await prisma.session.delete({
        where: { token: session.token },
      });
      throw new AppError(
        status.UNAUTHORIZED,
        'Unauthorized: Session fingerprint mismatch (IP Address)',
      );
    }
  }

  const accessToken = tokenUtils.getAccessToken({
    userId: result.user.id,
    role: result.user.role,
    name: result.user.name,
    email: result.user.email,
    status: result.user.status,
    emailVerified: result.user.emailVerified,
  });

  const refreshToken = tokenUtils.getRefreshToken({
    userId: result.user.id,
    role: result.user.role,
    name: result.user.name,
    email: result.user.email,
    status: result.user.status,
    emailVerified: result.user.emailVerified,
  });

  return {
    ...result,
    accessToken,
    refreshToken,
  };
};

export const AuthService = {
  loginUser,
  loginAdmin,
  logout,
  registerPatient,
  verifyEmailOtp,
  initiateGoogleLogin,
  verify2faOtp,
  resendOtp,
  getSession,
};
