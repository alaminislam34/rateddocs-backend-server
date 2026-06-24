import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import status from 'http-status';
import { auth } from '../config/auth.js';
import { AppError } from '../errors/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';
import { UserRole } from '../generated/prisma/index.js';

export const authMiddleware = (...allowedRoles: UserRole[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      throw new AppError(status.UNAUTHORIZED, 'Unauthorized: Access token is missing or invalid');
    }

    const user = session.user;

    // Check role access if allowedRoles are specified
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role as UserRole)) {
      throw new AppError(status.FORBIDDEN, 'Forbidden: You do not have permission to access this resource');
    }

    req.session = session.session;
    req.user = session.user;

    next();
  });
};
