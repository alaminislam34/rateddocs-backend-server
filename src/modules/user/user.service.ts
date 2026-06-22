import { prisma } from '../../config/db.js';

export const getUserById = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    include: {
      sessions: {
        select: {
          id: true,
          expiresAt: true,
          ipAddress: true,
          userAgent: true,
        },
      },
    },
  });
};

export const updateUser = async (id: string, data: { name?: string; image?: string }) => {
  return prisma.user.update({
    where: { id },
    data,
  });
};
