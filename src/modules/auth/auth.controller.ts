import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { auth } from '../../config/auth.js';
import { fromNodeHeaders } from 'better-auth/node';
import { UserRole } from '../../generated/prisma/index.js';
import { AppError } from '../../errors/AppError.js';
import { env } from '../../config/env.js';
import * as authService from './auth.service.js';

const handleCredentialsLogin = async (req: Request, res: Response, allowedRoles: UserRole[]) => {
  const { email, password } = req.body;

  await authService.verifyUserRoleAndGet(email, allowedRoles);

  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
    headers: fromNodeHeaders(req.headers),
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

  const data = await response.json();

  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Logged in successfully',
    data,
  });
};

/**
 * Log in a Patient
 */
export const loginPatient = catchAsync(async (req: Request, res: Response) => {
  await handleCredentialsLogin(req, res, [UserRole.PATIENT]);
});

/**
 * Log in a Dentist
 */
export const loginDentist = catchAsync(async (req: Request, res: Response) => {
  await handleCredentialsLogin(req, res, [UserRole.DENTIST]);
});

/**
 * Log in an Admin / Super Admin
 */
export const loginAdmin = catchAsync(async (req: Request, res: Response) => {
  await handleCredentialsLogin(req, res, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
});

/**
 * Register a new Patient and send verification OTP
 */
export const registerPatient = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const headers = fromNodeHeaders(req.headers);

  await authService.registerPatient(email, password, headers);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Patient registered successfully. A verification OTP has been sent to your email.',
    data: null,
  });
});

export const verifyEmailOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  const result = await authService.verifyEmailOtp(email, otp);

  // Set the session token in the response cookie to log the user in automatically
  res.cookie('better-auth.session_token', result.token, {
    path: '/',
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: result.expiresAt,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Email verified successfully. You have been logged in automatically.',
    data: {
      user: result.user,
      session: {
        token: result.token,
        expiresAt: result.expiresAt,
      },
    },
  });
});

/**
 * Initiates Google OAuth redirect flow
 */
export const initiateGoogleLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await auth.api.signInSocial({
    body: {
      provider: 'google',
      callbackURL: `${env.FRONTEND_URL}/dashboard`,
    },
    headers: fromNodeHeaders(req.headers),
  });

  if (result && 'url' in result && result.url) {
    res.redirect(result.url);
  } else {
    throw new AppError(500, 'Failed to initiate Google OAuth flow');
  }
});

/**
 * Invalidate session in database & clear cookies
 */
export const logout = catchAsync(async (req: Request, res: Response) => {
  // Invalidate session in database
  await auth.api.signOut({
    headers: fromNodeHeaders(req.headers),
  });

  // Explicitly clear session cookie
  res.clearCookie('better-auth.session-token', {
    path: '/',
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Logged out successfully',
    data: null,
  });
});
