import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync.js';
import { sendResponse } from '../../shared/sendResponse.js';
import { fromNodeHeaders } from 'better-auth/node';
import { AuthService } from './auth.service.js';
import status from 'http-status';
import { AppError } from '../../errors/AppError.js';
import { tokenUtils } from '../../utils/token.js';

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const clientHeaders = fromNodeHeaders(req.headers);

  const result = await AuthService.loginUser(payload, clientHeaders);

  if (result.twoFactorRequired) {
    sendResponse(res, {
      statusCode: status.OK,
      success: true,
      message: 'Two-step verification required. A verification OTP has been sent to your email.',
      data: {
        twoFactorRequired: true,
        email: result.email,
      },
    });
    return;
  }

  const { data, headers, accessToken, refreshToken } = result as {
    data: Record<string, unknown>;
    headers: [string, string][];
    accessToken: string;
    refreshToken: string;
  };
  headers.forEach(([key, value]: [string, string]) => {
    res.setHeader(key, value);
  });

  // Set secure HTTP-only cookies for JWT tokens
  tokenUtils.setAccessTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Logged in successfully',
    data: {
      ...data,
      accessToken,
      refreshToken,
    },
  });
});

const loginAdmin = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const clientHeaders = fromNodeHeaders(req.headers);

  const result = await AuthService.loginAdmin(payload, clientHeaders);

  if (result.twoFactorRequired) {
    sendResponse(res, {
      statusCode: status.OK,
      success: true,
      message: 'Two-step verification required. A verification OTP has been sent to your email.',
      data: {
        twoFactorRequired: true,
        email: result.email,
      },
    });
    return;
  }

  const { data, headers, accessToken, refreshToken } = result as {
    data: Record<string, unknown>;
    headers: [string, string][];
    accessToken: string;
    refreshToken: string;
  };
  headers.forEach(([key, value]: [string, string]) => {
    res.setHeader(key, value);
  });

  // Set secure HTTP-only cookies for JWT tokens
  tokenUtils.setAccessTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Logged in successfully',
    data: {
      ...data,
      accessToken,
      refreshToken,
    },
  });
});

const registerPatient = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const headers = fromNodeHeaders(req.headers);

  const result = await AuthService.registerPatient(email, password, headers);

  if (result && typeof result === 'object' && 'needEmailVerify' in result && result.needEmailVerify) {
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User is already registered but email is not verified. A verification OTP has been sent to your email.',
      data: {
        needEmailVerify: true,
        email: result.email,
      },
    });
    return;
  }

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Patient registered successfully. A verification OTP has been sent to your email.',
    data: null,
  });
});

const verifyEmailOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  const result = await AuthService.verifyEmailOtp(email, otp);

  // Set Better-Auth session cookie
  tokenUtils.setBetterAuthSessionTokenCookie(res, result.token);

  // Set secure HTTP-only cookies for JWT tokens
  tokenUtils.setAccessTokenCookie(res, result.accessToken);
  tokenUtils.setRefreshTokenCookie(res, result.refreshToken);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Email verified successfully. You have been logged in automatically.',
    data: {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      session: {
        token: result.token,
        expiresAt: result.expiresAt,
      },
    },
  });
});

const initiateGoogleLoginController = catchAsync(async (req: Request, res: Response) => {
  const clientHeaders = fromNodeHeaders(req.headers);
  const result = await AuthService.initiateGoogleLogin(clientHeaders);

  if (result.headers) {
    const setCookies = result.headers.getSetCookie();
    if (setCookies && setCookies.length > 0) {
      res.setHeader('Set-Cookie', setCookies);
    }

    result.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') {
        res.setHeader(key, value);
      }
    });
  }

  res.redirect(result.url);
});

const logout = catchAsync(async (req: Request, res: Response) => {
  const clientHeaders = fromNodeHeaders(req.headers);
  await AuthService.logout(clientHeaders);

  // Clear Better-Auth session cookies
  res.clearCookie('better-auth.session_token', { path: '/' });

  // Clear JWT access and refresh token cookies
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Logged out successfully',
    data: null,
  });
});

const verify2faOtp = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  const result = await AuthService.verify2faOtp(email, otp);

  // Set Better-Auth session cookie
  tokenUtils.setBetterAuthSessionTokenCookie(res, result.token);

  // Set secure HTTP-only cookies for JWT tokens
  tokenUtils.setAccessTokenCookie(res, result.accessToken);
  tokenUtils.setRefreshTokenCookie(res, result.refreshToken);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Two-step verification successful. You have been logged in.',
    data: {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      session: {
        token: result.token,
        expiresAt: result.expiresAt,
      },
    },
  });
});

const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;

  await AuthService.resendOtp(email);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Verification OTP has been resent to your email.',
    data: null,
  });
});

const getSession = catchAsync(async (req: Request, res: Response) => {
  const clientHeaders = fromNodeHeaders(req.headers);
  const incomingUserAgent = req.headers['user-agent'] as string | undefined;
  const incomingIp = ((req.headers['x-forwarded-for'] as string) ||
    req.socket.remoteAddress ||
    req.ip) as string | undefined;

  const result = await AuthService.getSession(clientHeaders, incomingUserAgent, incomingIp);

  if (!result) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: Access token is missing or invalid');
  }

  // Set secure HTTP-only cookies for JWT tokens
  tokenUtils.setAccessTokenCookie(res, result.accessToken);
  tokenUtils.setRefreshTokenCookie(res, result.refreshToken);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Session retrieved successfully.',
    data: result,
  });
});

export const AuthController = {
  loginUser,
  loginAdmin,
  logout,
  registerPatient,
  verifyEmailOtp,
  initiateGoogleLoginController,
  verify2faOtp,
  resendOtp,
  getSession,
};
