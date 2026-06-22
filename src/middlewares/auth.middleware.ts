import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../config/auth.js';
import { AppError } from '../errors/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

export const authMiddleware = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    throw new AppError(401, 'Unauthorized: Access token is missing or invalid');
  }

  req.session = session.session;
  req.user = session.user;

  next();
});
