import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { auth } from '../../config/auth.js';
import { fromNodeHeaders } from 'better-auth/node';

export const logout = catchAsync(async (req: Request, res: Response) => {
  // Invalidate better-auth session in database
  await auth.api.signOut({
    headers: fromNodeHeaders(req.headers),
  });

  // Explicitly clear session cookie
  res.clearCookie('better-auth.session-token', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Logged out successfully',
    data: null,
  });
});
