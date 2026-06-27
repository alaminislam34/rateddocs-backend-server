import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import status from 'http-status';
import { auth } from '../config/auth.js';
import { AppError } from '../errors/AppError.js';
import { catchAsync } from '../shared/catchAsync.js';
import { UserRole } from '../generated/prisma/index.js';
import { prisma } from '../config/db.js';

export const authMiddleware = (...allowedRoles: UserRole[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      throw new AppError(status.UNAUTHORIZED, 'Unauthorized: Access token is missing or invalid');
    }

    const incomingUserAgent = req.headers['user-agent'] as string | undefined;
    const incomingIp = ((req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      req.ip) as string | undefined;

    const sessionUserAgent = session.session.userAgent;
    const sessionIp = session.session.ipAddress;

    // 1. Verify User-Agent
    if (sessionUserAgent && incomingUserAgent && sessionUserAgent !== incomingUserAgent) {
      await prisma.session.delete({
        where: { token: session.session.token },
      });
      throw new AppError(
        status.UNAUTHORIZED,
        'Unauthorized: Session fingerprint mismatch (User-Agent)',
      );
    }

    // 2. Verify IP (Subnet Class C check)
    if (sessionIp && incomingIp && sessionIp !== incomingIp) {
      const isSubnetMatch = (ip1: string, ip2: string) => {
        const parts1 = ip1.split('.');
        const parts2 = ip2.split('.');
        if (parts1.length === 4 && parts2.length === 4) {
          return parts1[0] === parts2[0] && parts1[1] === parts2[1] && parts1[2] === parts2[2];
        }
        return false;
      };

      if (!isSubnetMatch(sessionIp, incomingIp)) {
        await prisma.session.delete({
          where: { token: session.session.token },
        });
        throw new AppError(
          status.UNAUTHORIZED,
          'Unauthorized: Session fingerprint mismatch (IP Address)',
        );
      }
    }

    const user = session.user;

    // Safety checks: verify if account is blocked, deleted, or suspended
    if (user.status === 'BLOCKED') {
      throw new AppError(status.FORBIDDEN, 'Forbidden: Your account has been blocked');
    }

    if (user.isDeleted || user.status === 'DELETED') {
      throw new AppError(status.FORBIDDEN, 'Forbidden: Your account has been deleted');
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError(status.FORBIDDEN, 'Forbidden: Your account has been suspended');
    }

    // Check role access if allowedRoles are specified
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role as UserRole)) {
      throw new AppError(
        status.FORBIDDEN,
        'Forbidden: You do not have permission to access this resource',
      );
    }

    req.session = session.session;
    req.user = session.user;

    next();
  });
};

import { verifyUserRoleAndGet } from '../modules/auth/auth.service.js';

const allowedRolesFn = (...roles: UserRole[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;
    if (!email) {
      throw new AppError(status.BAD_REQUEST, 'Email is required', 'email');
    }
    await verifyUserRoleAndGet(email, roles);
    next();
  });
};

export const allowedRoles = Object.assign(allowedRolesFn, {
  PATIENT: allowedRolesFn(UserRole.PATIENT),
  DENTIST: allowedRolesFn(UserRole.DENTIST),
  ADMIN: allowedRolesFn(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  SUPER_ADMIN: allowedRolesFn(UserRole.SUPER_ADMIN),
});
