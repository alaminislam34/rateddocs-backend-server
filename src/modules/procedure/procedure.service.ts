import status from 'http-status';
import { prisma } from '../../config/db.js';
import { ICreateDentistProcedure } from './procedure.interface.js';
import { Prisma } from '../../generated/prisma/index.js';
import { AppError } from '../../errors/AppError.js';

const toSlug = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const getGlobalProcedures = async (query: { search?: string }) => {
  const whereConditions: Prisma.GlobalProcedureWhereInput = query.search
    ? {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' as Prisma.QueryMode } },
        { slug: { contains: toSlug(query.search), mode: 'insensitive' as Prisma.QueryMode } },
      ],
      isDeleted: false,
    }
    : { isDeleted: false };

  return prisma.globalProcedure.findMany({
    where: whereConditions,
    orderBy: { name: 'asc' },
  });
};

const getDentistProcedures = async (userId: string) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  return prisma.dentistProcedure.findMany({
    where: { dentistId: dentist.id },
    include: {
      globalProcedure: true,
    },
    orderBy: {
      globalProcedure: {
        name: 'asc',
      },
    },
  });
};

const createDentistProcedure = async (userId: string, payload: ICreateDentistProcedure) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  const { procedureName, price, notes } = payload;
  const slug = toSlug(procedureName);

  return prisma.$transaction(async (tx) => {
    // 1. Resolve or create GlobalProcedure
    let globalProc = await tx.globalProcedure.findUnique({
      where: { slug },
    });

    if (!globalProc) {
      globalProc = await tx.globalProcedure.create({
        data: {
          name: procedureName.trim(),
          slug,
          isApproved: true,
          isActive: true,
        },
      });
    }

    // 2. Upsert DentistProcedure
    const dentistProc = await tx.dentistProcedure.upsert({
      where: {
        dentist_procedure_unique: {
          dentistId: dentist.id,
          globalProcedureId: globalProc.id,
        },
      },
      update: {
        price,
        notes: notes || null,
      },
      create: {
        dentistId: dentist.id,
        globalProcedureId: globalProc.id,
        price,
        notes: notes || null,
      },
      include: {
        globalProcedure: true,
      },
    });

    return dentistProc;
  });
};

const deleteDentistProcedure = async (userId: string, dentistProcedureId: string) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  const dentistProc = await prisma.dentistProcedure.findUnique({
    where: { id: dentistProcedureId },
  });

  if (!dentistProc || dentistProc.dentistId !== dentist.id) {
    throw new AppError(status.NOT_FOUND, 'Dentist procedure not found or unauthorized');
  }

  await prisma.dentistProcedure.delete({
    where: { id: dentistProcedureId },
  });

  return { message: 'Procedure removed from your profile successfully.' };
};

const bulkUploadDentistProcedures = async (userId: string, csvFile?: Express.Multer.File) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  if (!csvFile) {
    throw new AppError(status.BAD_REQUEST, 'CSV file is required');
  }

  const csvText = csvFile.buffer.toString('utf-8');
  const rows = csvText
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  if (rows.length === 0) {
    throw new AppError(status.BAD_REQUEST, 'CSV file is empty');
  }

  // Skip the header row if present (first cell is not a number)
  const dataRows =
    rows[0]?.split(',')[1] && isNaN(Number(rows[0].split(',')[1])) ? rows.slice(1) : rows;

  const results: unknown[] = [];

  await prisma.$transaction(async (tx) => {
    for (const row of dataRows) {
      const [rawName, rawPrice, rawNotes] = row.split(',').map((c) => c.trim());
      if (!rawName || !rawPrice) continue;

      const price = parseFloat(rawPrice);
      if (isNaN(price) || price <= 0) continue;

      const slug = toSlug(rawName);

      let globalProc = await tx.globalProcedure.findUnique({
        where: { slug },
      });

      if (!globalProc) {
        globalProc = await tx.globalProcedure.create({
          data: {
            name: rawName.trim(),
            slug,
            isApproved: true,
            isActive: true,
          },
        });
      }

      const dentistProc = await tx.dentistProcedure.upsert({
        where: {
          dentist_procedure_unique: {
            dentistId: dentist.id,
            globalProcedureId: globalProc.id,
          },
        },
        update: {
          price,
          notes: rawNotes || null,
        },
        create: {
          dentistId: dentist.id,
          globalProcedureId: globalProc.id,
          price,
          notes: rawNotes || null,
        },
      });

      results.push(dentistProc);
    }
  });

  return {
    message: `Successfully processed ${results.length} procedures from CSV.`,
    count: results.length,
  };
};

export const ProcedureService = {
  getGlobalProcedures,
  getDentistProcedures,
  createDentistProcedure,
  deleteDentistProcedure,
  bulkUploadDentistProcedures,
};
