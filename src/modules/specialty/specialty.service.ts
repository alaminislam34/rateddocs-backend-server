import status from 'http-status';
import { prisma } from '../../config/db.js';
import { AppError } from '../../errors/AppError.js';
import { ICreateSpecialtyPayload, IUpdateSpecialtyPayload } from './specialty.interface.js';
import { Prisma } from '../../generated/prisma/index.js';

const toSlug = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const getAllSpecialties = async (query: { search?: string }) => {
  const whereConditions: Prisma.SpecialtyWhereInput = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as Prisma.QueryMode } },
          { slug: { contains: toSlug(query.search), mode: 'insensitive' as Prisma.QueryMode } },
        ],
      }
    : {};

  return prisma.specialty.findMany({
    where: whereConditions,
    orderBy: { name: 'asc' },
  });
};

const createSpecialty = async (payload: ICreateSpecialtyPayload) => {
  const slug = toSlug(payload.name);

  // Check if name or slug already exists
  const existing = await prisma.specialty.findFirst({
    where: {
      OR: [{ name: { equals: payload.name, mode: 'insensitive' as Prisma.QueryMode } }, { slug }],
    },
  });

  if (existing) {
    throw new AppError(status.CONFLICT, 'Specialty with this name already exists', 'name');
  }

  return prisma.specialty.create({
    data: {
      name: payload.name.trim(),
      slug,
      description: payload.description || null,
    },
  });
};

const updateSpecialty = async (id: string, payload: IUpdateSpecialtyPayload) => {
  const specialty = await prisma.specialty.findUnique({
    where: { id },
  });

  if (!specialty) {
    throw new AppError(status.NOT_FOUND, 'Specialty not found');
  }

  const updateData: { name?: string; slug?: string; description?: string } = {};

  if (payload.name) {
    const slug = toSlug(payload.name);
    // Check if name or slug already exists on a different specialty
    const existing = await prisma.specialty.findFirst({
      where: {
        id: { not: id },
        OR: [{ name: { equals: payload.name, mode: 'insensitive' as Prisma.QueryMode } }, { slug }],
      },
    });

    if (existing) {
      throw new AppError(status.CONFLICT, 'Specialty with this name already exists', 'name');
    }

    updateData.name = payload.name.trim();
    updateData.slug = slug;
  }

  if (payload.description !== undefined) {
    updateData.description = payload.description;
  }

  return prisma.specialty.update({
    where: { id },
    data: updateData,
  });
};

const deleteSpecialty = async (id: string) => {
  const specialty = await prisma.specialty.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          dentists: true,
          procedures: true,
        },
      },
    },
  });

  if (!specialty) {
    throw new AppError(status.NOT_FOUND, 'Specialty not found');
  }

  if (specialty._count.dentists > 0) {
    throw new AppError(status.CONFLICT, 'Cannot delete specialty: Dentists are associated with it');
  }

  if (specialty._count.procedures > 0) {
    throw new AppError(
      status.CONFLICT,
      'Cannot delete specialty: Global Procedures are associated with it',
    );
  }

  await prisma.specialty.delete({
    where: { id },
  });

  return { message: 'Specialty deleted successfully' };
};

export const SpecialtyService = {
  getAllSpecialties,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
};
