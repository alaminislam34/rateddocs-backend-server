import status from 'http-status';
import { prisma } from '../config/db.js';
import { UserRole, UserStatus } from '../generated/prisma/index.js';
import { AppError } from '../errors/AppError.js';

// this is common user authorization checker. here will be check user deleted or not and user role
export const IsExistUser = async (email: string, role: UserRole[]) => {
    const user = await prisma.user.findUnique({
        where: { email, isDeleted: false },
        select: {
            id: true,
            name: true,
            firstName: true,
            role: true,
            emailVerified: true,
            isDeleted: true,
            status: true,
            twoFactorEnabled: true,
        },
    });

    if (!user) {
        throw new AppError(status.NOT_FOUND, 'User is not found!', 'email');
    }

    if (role.length > 0 && !role.includes(user.role as UserRole)) {
        throw new AppError(
            status.FORBIDDEN,
            `You are not authorized to perform this action! only ${role} can perform this action!`,
        );
    }

    if (user.emailVerified === false) {
        throw new AppError(
            status.FORBIDDEN,
            'Your email is not verified. Please verify your email.',
            'email',
        );
    }

    if (
        user.status === UserStatus.BLOCKED ||
        user.status === UserStatus.SUSPENDED ||
        user.status === UserStatus.DELETED
    ) {
        throw new AppError(status.FORBIDDEN, 'User is not active', 'status');
    }

    return user;
};
