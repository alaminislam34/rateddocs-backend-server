import status from 'http-status';
import { prisma } from '../../config/db.js';
import { AppError } from '../../errors/AppError.js';
import {
  VerificationStatus,
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
          verificationStatus: query.status as VerificationStatus,
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
      ? VerificationStatus.APPROVED
      : VerificationStatus.REJECTED;

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
    const statusVal = isApproved
      ? VerificationStatus.APPROVED
      : VerificationStatus.REJECTED;

    await tx.dentistOperationsVerification.update({
      where: { dentistId },
      data: {
        isVerified: isApproved,
        verificationStatus: statusVal,
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
    const statusVal = isApproved
      ? VerificationStatus.APPROVED
      : VerificationStatus.REJECTED;

    await tx.dentistClinicDepthVerification.update({
      where: { dentistId },
      data: {
        isVerified: isApproved,
        verificationStatus: statusVal,
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

const getVerificationRequestsList = async (query: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const skip = (page - 1) * limit;

  const whereConditions: Prisma.DentistWhereInput = query.search
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
    : {};

  const dentists = await prisma.dentist.findMany({
    where: whereConditions,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          dentist: true,
          image: true,
        },
      },
      specialty: true,
      dentistLicense: true,
      dentistLicenseVerifications: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
      dentistOperationsVerifications: true,
      dentistClinicDepthVerification: {
        include: {
          procedureDocs: true,
        },
      },
      dentistVerificationProgress: true,
      dentistProcedures: {
        include: {
          globalProcedure: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const mapped = dentists.map((dentist) => {
    const lVer = dentist.dentistLicense?.verificationStatus || VerificationStatus.PENDING;
    const op = dentist.dentistOperationsVerifications?.[0];
    const oVer = op ? (op.isVerified ? VerificationStatus.APPROVED : op.verificationStatus) : VerificationStatus.PENDING;
    const clinic = dentist.dentistClinicDepthVerification;
    const cVer = clinic ? (clinic.isVerified ? VerificationStatus.APPROVED : clinic.verificationStatus) : VerificationStatus.PENDING;

    let queueStatus: 'pending' | 'approved' | 'rejected' = 'pending';
    if (lVer === VerificationStatus.APPROVED && oVer === VerificationStatus.APPROVED && cVer === VerificationStatus.APPROVED) {
      queueStatus = 'approved';
    } else if (lVer === VerificationStatus.REJECTED || oVer === VerificationStatus.REJECTED || cVer === VerificationStatus.REJECTED) {
      queueStatus = 'rejected';
    }

    const latestLicenseVer = dentist.dentistLicenseVerifications?.[0];

    const proceduresFeature = dentist.dentistProcedures.map((proc) => ({
      id: proc.id,
      procedure_name: proc.globalProcedure.name,
      price: proc.price.toString(),
      currency: 'USD',
      option_notes: proc.notes || '',
      is_active: proc.isActive,
      procedure: proc.globalProcedureId,
    }));

    const materials = clinic?.procedureDocs.map((doc) => ({
      own_procedure: doc.dentistProcedureId,
      ce_certificate: doc.ceCertificate,
      material_brands: doc.materialBrands,
      invoice: doc.invoice,
      protocol_pdf: doc.protocolPdf,
    })) || [];

    return {
      id: dentist.id,
      license_verification: lVer,
      operations_verification: oVer,
      clinical_verification: cVer,
      face_match_score: 92,
      created_at: dentist.createdAt.toISOString(),
      updated_at: dentist.updatedAt.toISOString(),
      dentist: {
        id: dentist.id,
        full_name: `${dentist.user.firstName || ''} ${dentist.user.lastName || ''}`.trim(),
        specialty: dentist.specialty?.name || 'General',
        rdv_score: dentist.dentistVerificationProgress?.rvdScore || 0,
        created_at: dentist.createdAt.toISOString(),
        updated_at: dentist.updatedAt.toISOString(),
      },
      license_step: dentist.dentistLicense
        ? {
          id: dentist.dentistLicense.id,
          registration_authority_name: dentist.dentistLicense.registrationAuthority,
          created_at: dentist.dentistLicense.createdAt.toISOString(),
          updated_at: dentist.dentistLicense.updatedAt.toISOString(),
          professional_headshot: dentist.user.image || '',
          city: dentist.dentistLicense.city,
          country: dentist.dentistLicense.country,
          registration_no: dentist.dentistLicense.registrationNumber,
          doc_type: 'LICENSE',
          file: dentist.dentistLicense.licenseDocument || '',
          status: lVer,
          is_verified: dentist.dentistLicense.isVerified,
          verified_at: dentist.dentistLicense.verifiedAt?.toISOString() || null,
          reviewer_notes: latestLicenseVer?.verificationNote || '',
          dentist: dentist.id,
          verification: dentist.dentistLicense.id,
          registration_authority: dentist.dentistLicense.registrationAuthority,
        }
        : null,
      operation_step: op
        ? {
          id: op.id,
          status: oVer,
          is_verified: op.isVerified,
          verified_at: op.verifiedAt?.toISOString() || null,
          reviewer_notes: op.verificationNote || '',
          dentist: dentist.id,
          verification: op.id,
          sterilization_verification: {
            id: op.id,
            has_jci_certificate: !!op.jciCertificate,
            jci_certificate: op.jciCertificate,
            walkthrough_video: op.walkthroughVideo,
            certificate_number: null,
            expiry_date: null,
            issuing_authority: null,
            issue_date: null,
          },
          no_surprise_guarantee: op.agreedToGuarantee
            ? {
              id: op.id,
              allowed_variation_percent: '0',
              signer_name: op.signerName || '',
              typed_signature: op.signature || '',
              accepted_terms: true,
              signed_at: op.updatedAt.toISOString(),
            }
            : null,
          procedures_feature: proceduresFeature,
        }
        : null,
      clinical_step: clinic
        ? {
          id: clinic.id,
          status: cVer,
          is_verified: clinic.isVerified,
          verified_at: clinic.verifiedAt?.toISOString() || null,
          reviewer_notes: clinic.verificationNote || '',
          dentist: dentist.id,
          verification: clinic.id,
          clinic_address: clinic.clinicAddress || '',
          materials,
        }
        : null,
      queue_status: queueStatus,
    };
  });

  let total_dentists = 0;
  let pending_review = 0;
  let fully_approved = 0;
  let rejected = 0;

  mapped.forEach((item) => {
    total_dentists++;
    if (item.queue_status === 'approved') {
      fully_approved++;
    } else if (item.queue_status === 'rejected') {
      rejected++;
    } else {
      pending_review++;
    }
  });

  let filtered = mapped;
  if (query.status) {
    const filterStatus = query.status.toLowerCase();
    if (filterStatus === 'approved') {
      filtered = mapped.filter((item) => item.queue_status === 'approved');
    } else if (filterStatus === 'rejected') {
      filtered = mapped.filter((item) => item.queue_status === 'rejected');
    } else if (filterStatus === 'submitted' || filterStatus === 'pending') {
      filtered = mapped.filter((item) => item.queue_status === 'pending');
    }
  }

  const total = filtered.length;
  const paginatedData = filtered.slice(skip, skip + limit);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      total_dentists,
      pending_review,
      fully_approved,
      rejected,
    },
    status_counts: {
      total_dentists,
      pending_review,
      fully_approved,
      rejected,
    },
    data: paginatedData,
  };
};

export const AdminService = {
  getVerificationsListAdmin,
  verifyLicenseAdmin,
  verifyOperationsAdmin,
  verifyClinicDepthAdmin,
  getVerificationWeights,
  updateVerificationWeights,
  getVerificationRequestsList,
};
