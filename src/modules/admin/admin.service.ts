import status from 'http-status';
import { prisma } from '../../config/db.js';
import { AppError } from '../../errors/AppError.js';
import {
  LicenseVerificationStatus,
  DentistVerificationPhase,
  Prisma,
} from '../../generated/prisma/index.js';
import { IUpdateVerificationWeights } from './admin.interface.js';

const updateRvdScore = async (tx: Prisma.TransactionClient, dentistId: string) => {
  const progress = await tx.dentistVerificationProgress.findUnique({
    where: { dentistId },
  });

  if (!progress) return;

  const weights = await tx.verificationWeight.findFirst();
  const licenseWeight = weights?.licenseWeight ?? 30;
  const operationsWeight = weights?.operationsWeight ?? 40;
  const clinicDepthWeight = weights?.clinicDepthWeight ?? 30;

  let rvdScore = 0;
  if (progress.isLicenseVerified) rvdScore += licenseWeight;
  if (progress.isOperationsVerified) rvdScore += operationsWeight;
  if (progress.isClinicDepthVerified) rvdScore += clinicDepthWeight;

  await tx.dentistVerificationProgress.update({
    where: { dentistId },
    data: { rvdScore },
  });
};

const getVerificationsListAdmin = async (query: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const whereConditions: Prisma.DentistWhereInput = {
    ...(query.status
      ? {
          dentistLicense: {
            verificationStatus: query.status as LicenseVerificationStatus,
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            {
              user: {
                OR: [
                  { firstName: { contains: query.search, mode: 'insensitive' } },
                  { lastName: { contains: query.search, mode: 'insensitive' } },
                  { email: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            },
            {
              phoneNumber: { contains: query.search },
            },
          ],
        }
      : {}),
  };

  const dentists = await prisma.dentist.findMany({
    where: whereConditions,
    skip,
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          image: true,
        },
      },
      dentistProfessionalData: true,
      dentistLicense: true,
      dentistOperationsVerifications: true,
      dentistClinicDepthVerification: {
        include: {
          procedureDocs: true,
        },
      },
      dentistVerificationProgress: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const total = await prisma.dentist.count({ where: whereConditions });

  return {
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
    data: dentists,
  };
};

const verifyLicenseAdmin = async (dentistId: string, isApproved: boolean, note?: string) => {
  const dentist = await prisma.dentist.findUnique({
    where: { id: dentistId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  await prisma.$transaction(async (tx) => {
    const statusVal = isApproved
      ? LicenseVerificationStatus.VERIFIED
      : LicenseVerificationStatus.REJECTED;

    await tx.dentistLicense.update({
      where: { dentistId },
      data: {
        isVerified: isApproved,
        verificationStatus: statusVal,
        verifiedAt: isApproved ? new Date() : null,
      },
    });

    await tx.dentistVerificationProgress.update({
      where: { dentistId },
      data: {
        isLicenseVerified: isApproved,
        currentPhase: isApproved
          ? DentistVerificationPhase.OPERATIONS
          : DentistVerificationPhase.LICENSE,
      },
    });

    await tx.dentistLicenseVerification.create({
      data: {
        dentistId,
        verificationStatus: statusVal,
        isVerified: isApproved,
        verificationNote: note || (isApproved ? 'Approved by Admin' : 'Rejected by Admin'),
      },
    });

    await updateRvdScore(tx, dentistId);
  });

  return { message: `License verification status set to: ${isApproved ? 'VERIFIED' : 'REJECTED'}` };
};

const verifyOperationsAdmin = async (dentistId: string, isApproved: boolean, note?: string) => {
  const dentist = await prisma.dentist.findUnique({
    where: { id: dentistId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.dentistOperationsVerification.update({
      where: { dentistId },
      data: {
        isVerified: isApproved,
        verifiedAt: isApproved ? new Date() : null,
        verificationNote: note || (isApproved ? 'Approved by Admin' : 'Rejected by Admin'),
      },
    });

    await tx.dentistVerificationProgress.update({
      where: { dentistId },
      data: {
        isOperationsVerified: isApproved,
        currentPhase: isApproved
          ? DentistVerificationPhase.CLINIC
          : DentistVerificationPhase.OPERATIONS,
      },
    });

    await updateRvdScore(tx, dentistId);
  });

  return {
    message: `Operations verification status set to: ${isApproved ? 'VERIFIED' : 'REJECTED'}`,
  };
};

const verifyClinicDepthAdmin = async (dentistId: string, isApproved: boolean, note?: string) => {
  const dentist = await prisma.dentist.findUnique({
    where: { id: dentistId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.dentistClinicDepthVerification.update({
      where: { dentistId },
      data: {
        isVerified: isApproved,
        verifiedAt: isApproved ? new Date() : null,
        verificationNote: note || (isApproved ? 'Approved by Admin' : 'Rejected by Admin'),
      },
    });

    await tx.dentistVerificationProgress.update({
      where: { dentistId },
      data: {
        isClinicDepthVerified: isApproved,
        currentPhase: isApproved
          ? DentistVerificationPhase.CLINIC
          : DentistVerificationPhase.CLINIC,
      },
    });

    await updateRvdScore(tx, dentistId);
  });

  return {
    message: `Clinic depth verification status set to: ${isApproved ? 'VERIFIED' : 'REJECTED'}`,
  };
};

const getVerificationWeights = async () => {
  const weights = await prisma.verificationWeight.findFirst();
  if (!weights) {
    return {
      licenseWeight: 30,
      operationsWeight: 40,
      clinicDepthWeight: 30,
    };
  }
  return {
    licenseWeight: weights.licenseWeight,
    operationsWeight: weights.operationsWeight,
    clinicDepthWeight: weights.clinicDepthWeight,
  };
};

const updateVerificationWeights = async (payload: IUpdateVerificationWeights) => {
  const { licenseWeight, operationsWeight, clinicDepthWeight } = payload;

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.verificationWeight.findFirst();

    if (existing) {
      await tx.verificationWeight.update({
        where: { id: existing.id },
        data: {
          licenseWeight,
          operationsWeight,
          clinicDepthWeight,
        },
      });
    } else {
      await tx.verificationWeight.create({
        data: {
          licenseWeight,
          operationsWeight,
          clinicDepthWeight,
        },
      });
    }

    // Recalculate RVD Score for ALL dentists
    const progressRecords = await tx.dentistVerificationProgress.findMany();
    for (const record of progressRecords) {
      let rvdScore = 0;
      if (record.isLicenseVerified) rvdScore += licenseWeight;
      if (record.isOperationsVerified) rvdScore += operationsWeight;
      if (record.isClinicDepthVerified) rvdScore += clinicDepthWeight;

      await tx.dentistVerificationProgress.update({
        where: { id: record.id },
        data: { rvdScore },
      });
    }

    return {
      message: 'Verification weights updated and all dentist RVD scores recalculated successfully.',
      weights: {
        licenseWeight,
        operationsWeight,
        clinicDepthWeight,
      },
    };
  });
};

export const AdminService = {
  getVerificationsListAdmin,
  verifyLicenseAdmin,
  verifyOperationsAdmin,
  verifyClinicDepthAdmin,
  getVerificationWeights,
  updateVerificationWeights,
};
