import status from 'http-status';
import { prisma } from '../../config/db.js';
import { AppError } from '../../errors/AppError.js';
import { auth } from '../../config/auth.js';
import { generateAndSendOTP } from '../auth/auth.service.js';
import { UserRole, LicenseVerificationStatus, DentistVerificationPhase, Prisma } from '../../generated/prisma/index.js';
import { uploadToCloudinary } from '../../utils/fileUpload.js';
import {
  IRegisterDentist,
  ISubmitProfessionalData,
  ICheckLicense,
  ISubmitLicense,
  ISubmitOperations,
  ISubmitClinicDepth,
} from './dentist.interface.js';

/**
 * Converts a free-text procedure name to a URL-friendly slug.
 * e.g. "Teeth Whitening!" → "teeth-whitening"
 */
const toSlug = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

/**
 * Finds an existing GlobalProcedure by slug-match, or creates a new one.
 * This prevents duplicate global procedures regardless of whether the
 * dentist typed a name manually or uploaded via CSV.
 */
const resolveOrCreateGlobalProcedure = async (
  tx: Prisma.TransactionClient,
  name: string,
): Promise<{ id: string }> => {
  const slug = toSlug(name);

  // 1. Try exact slug match first (canonical match)
  const existing = await tx.globalProcedure.findUnique({
    where: { slug },
  });

  if (existing) return existing;

  // 2. No match — create a new GlobalProcedure
  return tx.globalProcedure.create({
    data: {
      name: name.trim(),
      slug,
      isApproved: true,
      isActive: true,
    },
  });
};

/**
 * Upserts a DentistProcedure for a resolved GlobalProcedure.
 * Finds an existing dentist-procedure link by (dentistId, globalProcedureId)
 * and updates it, or creates a new one.
 */
const upsertDentistProcedure = async (
  tx: Prisma.TransactionClient,
  dentistId: string,
  globalProcedureId: string,
  price: number,
  notes?: string,
) => {
  // Uses the compound unique constraint (dentistId, globalProcedureId)
  // to atomically update existing or create new — zero duplicates guaranteed.
  return tx.dentistProcedure.upsert({
    where: {
      dentist_procedure_unique: { dentistId, globalProcedureId },
    },
    create: { dentistId, globalProcedureId, price, notes: notes || null },
    update: { price, notes: notes || null },
  });
};



/**
 * Recalculates the dynamic RVD score for a dentist based on their verification status.
 * License: 30%, Operations: 40%, Clinic Depth: 30%.
 */
const updateRvdScore = async (tx: Prisma.TransactionClient, dentistId: string) => {
  const progress = await tx.dentistVerificationProgress.findUnique({
    where: { dentistId },
  });

  if (!progress) return;

  let rvdScore = 0;
  if (progress.isLicenseVerified) rvdScore += 30;
  if (progress.isOperationsVerified) rvdScore += 40;
  if (progress.isClinicDepthVerified) rvdScore += 30;

  await tx.dentistVerificationProgress.update({
    where: { dentistId },
    data: { rvdScore },
  });
};

/**
 * Registers a new Dentist, creates their profiles and verification tracker, and dispatches email OTP.
 */
export const registerDentist = async (payload: IRegisterDentist, headers: Headers, headshotFile?: Express.Multer.File) => {
  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    gender,
    country,
    referralCode,
    password,
  } = payload;

  // 1. Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    if (existingUser.emailVerified) {
      throw new AppError(status.CONFLICT, 'User with this email already exists', 'email');
    }
    // Delete unverified user
    await prisma.user.delete({
      where: { id: existingUser.id },
    });
  }

  // 2. Call Better-Auth signUpEmail to hash password and register user
  const name = `${firstName} ${lastName}`;
  const signUpResult = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name,
    },
    headers,
  });

  if (!signUpResult || !signUpResult.user) {
    throw new AppError(status.INTERNAL_SERVER_ERROR, 'Failed to register user in Better-Auth');
  }

  const userId = signUpResult.user.id;

  let headshotUrl: string | undefined;
  if (headshotFile) {
    const uploadResult = await uploadToCloudinary(headshotFile.buffer, 'dentists/headshots');
    headshotUrl = uploadResult.secure_url;
  }

  // 3. Update User role and details, create Dentist profile and progress in transaction
  const dentist = await prisma.$transaction(async (tx) => {
    // Upgrade user role to DENTIST
    await tx.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        gender,
        image: headshotUrl || null,
        role: UserRole.DENTIST,
      },
    });

    // Create Dentist record
    const newDentist = await tx.dentist.create({
      data: {
        userId,
        phoneNumber,
        country,
        referralCode,
      },
    });

    // Create Dentist Verification Progress
    await tx.dentistVerificationProgress.create({
      data: {
        dentistId: newDentist.id,
        currentPhase: DentistVerificationPhase.LICENSE,
        nextPhase: DentistVerificationPhase.OPERATIONS,
        rvdScore: 0,
      },
    });

    return newDentist;
  });

  // 4. Generate and send verification OTP
  await generateAndSendOTP(email, name);

  return dentist;
};

/**
 * Submits Dentist Professional Data (legal name, specialty, etc.)
 */
export const submitProfessionalData = async (userId: string, payload: ISubmitProfessionalData) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  // Find or create primary specialty
  let specialty = await prisma.specialty.findFirst({
    where: {
      OR: [
        { id: payload.primarySpecialty },
        { name: { equals: payload.primarySpecialty, mode: 'insensitive' } },
      ],
    },
  });

  if (!specialty) {
    // Automatically seed a specialty if not found for testing
    const slug = payload.primarySpecialty.toLowerCase().replace(/\s+/g, '-');
    specialty = await prisma.specialty.create({
      data: {
        name: payload.primarySpecialty,
        slug,
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    // Update Dentist basic details
    await tx.dentist.update({
      where: { id: dentist.id },
      data: {
        country: payload.country,
        specialtyId: specialty.id,
      },
    });

    // Upsert Professional Data
    await tx.dentistProfessionalData.upsert({
      where: { dentistId: dentist.id },
      update: {
        legalName: payload.legalName,
        yearsOfExperience: payload.yearsOfExperience,
        city: payload.city,
      },
      create: {
        dentistId: dentist.id,
        legalName: payload.legalName,
        yearsOfExperience: payload.yearsOfExperience,
        city: payload.city,
      },
    });
  });

  return { message: 'Professional data saved successfully' };
};

/**
 * Simulates check against official registry.
 * Always fails to force manual document verification per requirements.
 */
export const checkLicenseRegistry = async (userId: string, _payload: ICheckLicense) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  // Simulation: Return error stating they do not exist in the official database
  throw new AppError(
    status.NOT_FOUND,
    'License registration number not found in the official registry database. Please upload your license certificate PDF for manual verification.',
    'registrationNumber'
  );
};

/**
 * Submits Dentist License PDF for manual verification.
 */
export const submitLicense = async (
  userId: string,
  payload: ISubmitLicense,
  licenseFile?: Express.Multer.File,
  profilePictureFile?: Express.Multer.File
) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  if (!licenseFile) {
    throw new AppError(status.BAD_REQUEST, 'License certificate file is required', 'licenseDocument');
  }

  const uploadResult = await uploadToCloudinary(licenseFile.buffer, 'dentists/licenses');
  const licenseDocumentUrl = uploadResult.secure_url;

  let profilePictureUrl: string | undefined;
  if (profilePictureFile) {
    const uploadProfileResult = await uploadToCloudinary(profilePictureFile.buffer, 'dentists/headshots');
    profilePictureUrl = uploadProfileResult.secure_url;
  }

  await prisma.$transaction(async (tx) => {
    // 1. Upsert DentistLicense
    await tx.dentistLicense.upsert({
      where: { dentistId: dentist.id },
      update: {
        country: payload.country,
        city: payload.city,
        registrationAuthority: payload.registrationAuthority,
        registrationNumber: payload.registrationNumber,
        licenseDocument: licenseDocumentUrl,
        verificationStatus: LicenseVerificationStatus.PENDING,
        isVerified: false,
      },
      create: {
        dentistId: dentist.id,
        country: payload.country,
        city: payload.city,
        registrationAuthority: payload.registrationAuthority,
        registrationNumber: payload.registrationNumber,
        licenseDocument: licenseDocumentUrl,
        verificationStatus: LicenseVerificationStatus.PENDING,
        isVerified: false,
      },
    });

    // 2. Update user profile picture if provided
    if (profilePictureUrl) {
      await tx.user.update({
        where: { id: userId },
        data: { image: profilePictureUrl },
      });
    }

    // 3. Create DentistLicenseVerification log entry
    await tx.dentistLicenseVerification.create({
      data: {
        dentistId: dentist.id,
        verificationStatus: LicenseVerificationStatus.PENDING,
        isVerified: false,
        verificationRequestNote: 'Manual license document and profile picture submitted for review.',
      },
    });
  });

  return { message: 'License document and profile picture submitted for verification successfully.' };
};

/**
 * Submits Dentist Operations (JCI certificate, walkthrough videos, agreedToGuarantee, and procedures).
 */
export const submitOperations = async (
  userId: string,
  payload: ISubmitOperations,
  jciFile?: Express.Multer.File,
  videoFile?: Express.Multer.File,
  csvFile?: Express.Multer.File
) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  let jciUrl: string | undefined;
  if (jciFile) {
    const uploadResult = await uploadToCloudinary(jciFile.buffer, 'dentists/operations/certificates');
    jciUrl = uploadResult.secure_url;
  }

  let videoUrl: string | undefined;
  if (videoFile) {
    const uploadResult = await uploadToCloudinary(videoFile.buffer, 'dentists/operations/videos');
    videoUrl = uploadResult.secure_url;
  }

  const existingOps = await prisma.dentistOperationsVerification.findUnique({
    where: { dentistId: dentist.id },
  });

  const finalJciUrl = jciUrl || existingOps?.jciCertificate || null;
  const finalVideoUrl = videoUrl || existingOps?.walkthroughVideo || null;

  if (!finalJciUrl && !finalVideoUrl) {
    throw new AppError(status.BAD_REQUEST, 'Either JCI Certificate or Walkthrough Video file must be uploaded.', 'jciCertificate');
  }

  await prisma.$transaction(async (tx) => {
    // 1. Update/Create operations verification
    await tx.dentistOperationsVerification.upsert({
      where: { dentistId: dentist.id },
      update: {
        jciCertificate: finalJciUrl,
        walkthroughVideo: finalVideoUrl,
        signerName: payload.signerName,
        signature: payload.signature,
        agreedToGuarantee: payload.agreedToGuarantee,
        isVerified: false,
      },
      create: {
        dentistId: dentist.id,
        jciCertificate: finalJciUrl,
        walkthroughVideo: finalVideoUrl,
        signerName: payload.signerName,
        signature: payload.signature,
        agreedToGuarantee: payload.agreedToGuarantee,
        isVerified: false,
      },
    });

    // 2. Auto-resolve & upsert procedures from the payload array
    if (payload.procedures && payload.procedures.length > 0) {
      for (const proc of payload.procedures) {
        // proc.procedureName is a free-text name. The resolver will slug-match
        // against existing GlobalProcedures or create a new one — no duplicates.
        const globalProc = await resolveOrCreateGlobalProcedure(tx, proc.procedureName);
        await upsertDentistProcedure(tx, dentist.id, globalProc.id, proc.price, proc.notes);
      }
    }

    // 3. Parse & process CSV file if provided
    // Expected CSV format (with header row): procedure_name,price,notes
    // Example row: "Teeth Whitening,250,Premium session"
    if (csvFile) {
      const csvText = csvFile.buffer.toString('utf-8');
      const rows = csvText
        .split('\n')
        .map((r) => r.trim())
        .filter((r) => r.length > 0);

      // Skip the header row if present (first cell is not a number)
      const dataRows = rows[0]?.split(',')[1] && isNaN(Number(rows[0].split(',')[1]))
        ? rows.slice(1)
        : rows;

      for (const row of dataRows) {
        const [rawName, rawPrice, rawNotes] = row.split(',').map((c) => c.trim());
        if (!rawName || !rawPrice) continue;

        const price = parseFloat(rawPrice);
        if (isNaN(price) || price <= 0) continue;

        const globalProc = await resolveOrCreateGlobalProcedure(tx, rawName);
        await upsertDentistProcedure(tx, dentist.id, globalProc.id, price, rawNotes || undefined);
      }
    }
  });

  return { message: 'Operations details and procedures submitted successfully.' };
};

/**
 * Submits Dentist Clinic Depth verification details.
 */
export const submitClinicDepth = async (userId: string, payload: ISubmitClinicDepth) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  await prisma.$transaction(async (tx) => {
    // 1. Create/Update clinic depth verification
    const verification = await tx.dentistClinicDepthVerification.upsert({
      where: { dentistId: dentist.id },
      update: {
        clinicAddress: payload.clinicAddress,
        isVerified: false,
      },
      create: {
        dentistId: dentist.id,
        clinicAddress: payload.clinicAddress,
        isVerified: false,
      },
    });

    // Clean up old procedure documents for this verification
    await tx.dentistClinicalProcedureDoc.deleteMany({
      where: { clinicDepthVerificationId: verification.id },
    });

    // 2. Add new procedure documents
    for (const doc of payload.procedureDocs) {
      await tx.dentistClinicalProcedureDoc.create({
        data: {
          clinicDepthVerificationId: verification.id,
          dentistProcedureId: doc.dentistProcedureId,
          ceCertificate: doc.ceCertificate || null,
          materialBrands: doc.materialBrands || null,
          invoice: doc.invoice || null,
          protocolPdf: doc.protocolPdf || null,
        },
      });
    }
  });

  return { message: 'Clinic depth verification documents submitted successfully.' };
};

/**
 * Admin: Verify Dentist License (Adds 30% to RVD Score)
 */
export const verifyLicenseAdmin = async (dentistId: string, isApproved: boolean, note?: string) => {
  const dentist = await prisma.dentist.findUnique({
    where: { id: dentistId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  await prisma.$transaction(async (tx) => {
    const statusVal = isApproved ? LicenseVerificationStatus.VERIFIED : LicenseVerificationStatus.REJECTED;

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
        currentPhase: isApproved ? DentistVerificationPhase.OPERATIONS : DentistVerificationPhase.LICENSE,
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

/**
 * Admin: Verify Dentist Operations (Adds 40% to RVD Score)
 */
export const verifyOperationsAdmin = async (dentistId: string, isApproved: boolean, note?: string) => {
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
        currentPhase: isApproved ? DentistVerificationPhase.CLINIC : DentistVerificationPhase.OPERATIONS,
      },
    });

    await updateRvdScore(tx, dentistId);
  });

  return { message: `Operations verification status set to: ${isApproved ? 'VERIFIED' : 'REJECTED'}` };
};

/**
 * Admin: Verify Dentist Clinic Depth (Adds 30% to RVD Score)
 */
export const verifyClinicDepthAdmin = async (dentistId: string, isApproved: boolean, note?: string) => {
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
        currentPhase: isApproved ? DentistVerificationPhase.CLINIC : DentistVerificationPhase.CLINIC, // Remains in clinic/fully verified
      },
    });

    await updateRvdScore(tx, dentistId);
  });

  return { message: `Clinic depth verification status set to: ${isApproved ? 'VERIFIED' : 'REJECTED'}` };
};

/**
 * Retrieve current dentist verification progress and score
 */
export const getVerificationProgress = async (userId: string) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  const progress = await prisma.dentistVerificationProgress.findUnique({
    where: { dentistId: dentist.id },
  });

  return progress;
};

/**
 * Admin: Retrieve list of all dentist verification submissions with filter, search, and pagination.
 */
export const getVerificationsListAdmin = async (query: {
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
