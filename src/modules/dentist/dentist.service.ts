import status from 'http-status';
import { prisma } from '../../config/db.js';
import { auth } from '../../config/auth.js';
import { generateAndSendOTP } from '../../shared/generateOtp.js';
import {
  UserRole,
  VerificationStatus,
  DentistVerificationPhase,
  Prisma,
} from '../../generated/prisma/index.js';
import { uploadToCloudinary } from '../../shared/fileUpload.js';
import {
  IRegisterDentist,
  ISubmitProfessionalData,
  ICheckLicense,
  ISubmitLicense,
  ISubmitOperations,
  ISubmitClinicDepth,
  IVerificationProgress,
} from './dentist.interface.js';
import { AppError } from '../../errors/AppError.js';

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
 * Registers a new Dentist, creates their profiles and verification tracker, and dispatches email OTP.
 */
const registerDentist = async (
  payload: IRegisterDentist,
  headers: Headers,
  headshotFile?: Express.Multer.File,
) => {
  const { firstName, lastName, email, phoneNumber, gender, referralCode, password } =
    payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    if (existingUser.emailVerified) {
      throw new AppError(status.CONFLICT, 'User with this email already exists.', 'email');
    }
    // Generate and send verification OTP
    const name = `${firstName} ${lastName}`;
    await generateAndSendOTP(email, name);

    return {
      needEmailVerify: true,
      email,
    };
  }

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

  const dentist = await prisma.$transaction(async (tx) => {
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
const submitProfessionalData = async (userId: string, payload: ISubmitProfessionalData) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  // Find primary specialty (must be pre-created by admin)
  const specialty = await prisma.specialty.findFirst({
    where: {
      OR: [
        { id: payload.primarySpecialty },
        { name: { equals: payload.primarySpecialty, mode: 'insensitive' } },
      ],
    },
  });

  if (!specialty) {
    throw new AppError(
      status.NOT_FOUND,
      'Selected primary specialty is invalid or not registered by admin. Please contact support.',
      'primarySpecialty',
    );
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
const checkLicenseRegistry = async (userId: string, _payload: ICheckLicense) => {
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
    'registrationNumber',
  );
};

/**
 * Submits Dentist License PDF for manual verification.
 */
const submitLicense = async (
  userId: string,
  payload: ISubmitLicense,
  licenseFile?: Express.Multer.File,
  profilePictureFile?: Express.Multer.File,
) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  if (!licenseFile) {
    throw new AppError(
      status.BAD_REQUEST,
      'License certificate file is required',
      'licenseDocument',
    );
  }

  const uploadResult = await uploadToCloudinary(licenseFile.buffer, 'dentists/licenses');
  const licenseDocumentUrl = uploadResult.secure_url;

  let profilePictureUrl: string | undefined;
  if (profilePictureFile) {
    const uploadProfileResult = await uploadToCloudinary(
      profilePictureFile.buffer,
      'dentists/headshots',
    );
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
        verificationStatus: VerificationStatus.PENDING,
        isVerified: false,
      },
      create: {
        dentistId: dentist.id,
        country: payload.country,
        city: payload.city,
        registrationAuthority: payload.registrationAuthority,
        registrationNumber: payload.registrationNumber,
        licenseDocument: licenseDocumentUrl,
        verificationStatus: VerificationStatus.PENDING,
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
        verificationStatus: VerificationStatus.PENDING,
        isVerified: false,
        verificationRequestNote:
          'Manual license document and profile picture submitted for review.',
      },
    });
  });

  return {
    message: 'License document and profile picture submitted for verification successfully.',
  };
};

/**
 * Submits Dentist Operations (JCI certificate, walkthrough videos, agreedToGuarantee, and procedures).
 */
const submitOperations = async (
  userId: string,
  payload: ISubmitOperations,
  jciFile?: Express.Multer.File,
  videoFile?: Express.Multer.File,
  csvFile?: Express.Multer.File,
) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  let jciUrl: string | undefined;
  if (jciFile) {
    const uploadResult = await uploadToCloudinary(
      jciFile.buffer,
      'dentists/operations/certificates',
    );
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
    throw new AppError(
      status.BAD_REQUEST,
      'Either JCI Certificate or Walkthrough Video file must be uploaded.',
      'jciCertificate',
    );
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
      const dataRows =
        rows[0]?.split(',')[1] && isNaN(Number(rows[0].split(',')[1])) ? rows.slice(1) : rows;

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
const submitClinicDepth = async (userId: string, payload: ISubmitClinicDepth) => {
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
 * Retrieve current dentist verification progress and score
 */
const getVerificationProgress = async (userId: string): Promise<IVerificationProgress> => {
  // 1. Fetch dentist with all related data
  const dentist = await prisma.dentist.findFirst({
    where: { userId },
    include: {
      user: true,
      dentistLicense: true,
      dentistOperationsVerifications: true,
      dentistClinicDepthVerification: true,
      dentistVerificationProgress: true,
      dentistProcedures: {
        include: {
          globalProcedure: true,
        },
      },
    },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  // 2. Extract related data with proper null/array handling
  // Note: Adjust based on your Prisma schema (one-to-one vs one-to-many)
  const dbProgress = Array.isArray(dentist.dentistVerificationProgress)
    ? dentist.dentistVerificationProgress[0] || null
    : dentist.dentistVerificationProgress;

  const depthVerification = Array.isArray(dentist.dentistClinicDepthVerification)
    ? dentist.dentistClinicDepthVerification[0] || null
    : dentist.dentistClinicDepthVerification;

  const operationsVerification = dentist.dentistOperationsVerifications?.[0] || null;
  const license = dentist.dentistLicense;

  // 3. Calculate Step 1: License Status
  let stepOneStatus: VerificationStatus = VerificationStatus.PENDING;

  if (dbProgress?.isLicenseVerified) {
    stepOneStatus = VerificationStatus.APPROVED;
  } else if (license) {
    const licenseStatus = license.verificationStatus;
    if (licenseStatus === VerificationStatus.APPROVED) {
      stepOneStatus = VerificationStatus.APPROVED;
    } else if (licenseStatus === VerificationStatus.REJECTED) {
      stepOneStatus = VerificationStatus.REJECTED;
    } else {
      stepOneStatus = VerificationStatus.SUBMITTED;
    }
  }

  // 4. Calculate Step 2: Operations Status
  let stepTwoStatus: VerificationStatus = VerificationStatus.PENDING;

  if (dbProgress?.isOperationsVerified || operationsVerification?.isVerified) {
    stepTwoStatus = VerificationStatus.APPROVED;
  } else if (operationsVerification) {
    stepTwoStatus = VerificationStatus.SUBMITTED;
  }

  // 5. Calculate Step 3: Clinical Depth Status
  let stepThreeStatus: VerificationStatus = VerificationStatus.PENDING;

  if (dbProgress?.isClinicDepthVerified || depthVerification?.isVerified) {
    stepThreeStatus = VerificationStatus.APPROVED;
  } else if (depthVerification) {
    stepThreeStatus = VerificationStatus.SUBMITTED;
  }

  // 6. Calculate completion flags
  const isStepOneCompleted = stepOneStatus === VerificationStatus.APPROVED;
  const isStepTwoCompleted = stepTwoStatus === VerificationStatus.APPROVED;
  const isStepThreeCompleted = stepThreeStatus === VerificationStatus.APPROVED;

  // 7. Calculate progress percentage
  const progressPercentage =
    (isStepOneCompleted ? 30 : 0) +
    (isStepTwoCompleted ? 40 : 0) +
    (isStepThreeCompleted ? 30 : 0);

  // 8. Build steps array
  const steps = [
    {
      phase: 'LICENSE',
      completed: isStepOneCompleted,
      status: stepOneStatus
    },
    {
      phase: 'OPERATIONAL',
      completed: isStepTwoCompleted,
      status: stepTwoStatus
    },
    {
      phase: 'CLINICAL',
      completed: isStepThreeCompleted,
      status: stepThreeStatus
    },
  ];

  // 9. Build response
  return {
    is_step_one_completed: isStepOneCompleted,
    is_step_two_completed: isStepTwoCompleted,
    is_step_three_completed: isStepThreeCompleted,
    step_one_status: stepOneStatus,
    step_two_status: stepTwoStatus,
    step_three_status: stepThreeStatus,
    is_verified: isStepOneCompleted && isStepTwoCompleted && isStepThreeCompleted,
    verification_phase: dbProgress?.currentPhase || 'LICENSE',
    progress_percentage: progressPercentage,
    score: progressPercentage,
    steps,
    dentistLicense: license
      ? {
        country: license.country,
        city: license.city,
        registrationAuthority: license.registrationAuthority,
        registrationNumber: license.registrationNumber,
        licenseDocument: license.licenseDocument,
        image: dentist.user?.image || null,
      }
      : null,
    dentistOperations: operationsVerification
      ? {
        jciCertificate: operationsVerification.jciCertificate,
        walkthroughVideo: operationsVerification.walkthroughVideo,
        signerName: operationsVerification.signerName,
        signature: operationsVerification.signature,
        agreedToGuarantee: operationsVerification.agreedToGuarantee,
      }
      : null,
    procedures: (dentist.dentistProcedures || []).map((dp) => ({
      id: dp.id,
      procedureName: dp.globalProcedure.name,
      price: Number(dp.price),
      notes: dp.notes,
    })),
  };
};
const dentistProfile = async (userId: string) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dentist: {
        include: {
          user: true,
          dentistClinicDepthVerification: true,
          dentistLicense: true,
          dentistLicenseVerifications: true,
          dentistOperationsVerifications: true,
          specialty: true,
          dentistProcedures: true,
          dentistProfessionalData: true,
          treatmentPlans: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, 'User profile not found');
  }

  return user;
}

const getOverviewData = async (userId: string) => {
  const dentist = await prisma.dentist.findUnique({
    where: { userId },
    include: {
      user: true,
      dentistVerificationProgress: true,
      treatmentPlans: {
        include: {
          patient: {
            include: {
              user: true,
            },
          },
          lineItems: {
            include: {
              globalProcedure: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!dentist) {
    throw new AppError(status.NOT_FOUND, 'Dentist profile not found');
  }

  // 1. Process treatment plans
  const mappedPlans = (dentist.treatmentPlans || []).map((tp) => {
    const finalBudget = (tp.lineItems || []).reduce((sum, item) => {
      const price = Number(item.unitPrice);
      const qty = item.quantity || 1;
      return sum + price * qty;
    }, 0);

    const firstProcedure = tp.lineItems?.[0]?.globalProcedure?.name || 'General Dental';

    let displayStatus = 'Pending';
    if (tp.status === 'ACTIVE') displayStatus = 'In Progress';
    if (tp.status === 'COMPLETED') displayStatus = 'Completed';
    if (tp.status === 'CANCELLED') displayStatus = 'Cancelled';

    const travelDate = tp.createdAt.toISOString().split('T')[0];

    return {
      patient_info: {
        name: tp.patient?.user?.name || 'Patient',
        image: tp.patient?.user?.image || '',
        treatment_plan: tp.status === 'ACTIVE' || tp.status === 'COMPLETED' ? 'accepted' : 'awaiting response',
        email: tp.patient?.user?.email || `patient-${tp.patientId}@rateddocs.com`,
        procedure: firstProcedure,
        status: displayStatus,
        payment_status: tp.status === 'COMPLETED' ? 'Paid' : 'Pending',
        final_budget: finalBudget,
      },
      estimate_treatment_plan: {
        estimate_amount_total: finalBudget,
      },
      final_treatment_plan: {
        final_total: finalBudget,
        status_tag: tp.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
      },
      patient_timeline: [
        {
          event: 'Inquiry',
          date: travelDate,
          details: 'Patient submitted initial treatment inquiry.',
        },
        {
          event: 'Treatment Plan Created',
          date: travelDate,
          details: 'Treatment plan estimation has been generated.',
        },
      ],
      payment_and_documents: {
        attached_document: null,
      },
      review: null,
    };
  });

  // 2. Separate cases/bookings
  const activeBookings = mappedPlans.filter((p) => p.patient_info.status === 'In Progress').slice(0, 3);
  const acceptedCases = mappedPlans.filter((p) => p.patient_info.treatment_plan === 'accepted');
  const completedCases = mappedPlans.filter((p) => p.patient_info.status === 'Completed');
  const pendingCases = mappedPlans.filter((p) => p.patient_info.status === 'Pending');
  const cancelledCases = mappedPlans.filter((p) => p.patient_info.status === 'Cancelled');

  const monthlyRevenue = [...acceptedCases, ...completedCases].reduce(
    (sum, p) => sum + p.patient_info.final_budget,
    0,
  );

  const verifiedRate = dentist.dentistVerificationProgress?.rvdScore || 0;
  const estimateAccuracy = completedCases.length > 0 ? 100 : 0;
  const disputeRate = mappedPlans.length > 0 ? Math.round((cancelledCases.length / mappedPlans.length) * 100) : 0;

  // 3. Alerts
  const alerts = [];
  if (pendingCases.length > 0) {
    alerts.push({
      label: 'New booking request',
      detail: `${pendingCases[0].patient_info.name} is interested in ${pendingCases[0].patient_info.procedure}. Respond within 24 hours.`,
    });
  } else {
    alerts.push({
      label: 'Booking Request',
      detail: 'No pending booking requests. Ensure your procedures list is updated.',
    });
  }

  alerts.push({
    label: 'Profile Status',
    detail: dentist.dentistVerificationProgress?.isClinicDepthVerified
      ? 'Verification complete! Your profile is now live.'
      : 'Complete your verification phases to receive active bookings.',
  });

  const referralSummary = [
    { label: 'Verified cases', value: acceptedCases.length + completedCases.length },
    { label: 'Pending replies', value: pendingCases.length },
    { label: 'Cancelled cases', value: cancelledCases.length },
  ];

  const referralCode = dentist.referralCode || `RD-DR-${dentist.id.substring(0, 6).toUpperCase()}`;

  return {
    stats: [
      {
        label: 'Active bookings',
        value: activeBookings.length,
        subLabel: activeBookings.length > 0 ? 'Currently in progress' : 'No active bookings',
        trend: activeBookings.length > 0 ? 'positive' : 'neutral',
        icon: 'calendar',
        accent: 'Active bookings',
      },
      {
        label: 'Pending estimates',
        value: pendingCases.length,
        subLabel: pendingCases.length > 0 ? 'Needs response' : 'All caught up',
        trend: pendingCases.length > 0 ? 'negative' : 'neutral',
        icon: 'clock',
        accent: 'Pending estimates',
        highlight: pendingCases.length > 0,
      },
      {
        label: 'Monthly revenue',
        value: `$${monthlyRevenue.toLocaleString()}`,
        subLabel: monthlyRevenue > 0 ? 'Based on accepted/completed plans' : 'No revenue yet',
        trend: monthlyRevenue > 0 ? 'positive' : 'neutral',
        icon: 'dollar',
        accent: 'Monthly revenue',
      },
      {
        label: 'Estimate accuracy rate',
        value: `${estimateAccuracy}%`,
        subLabel: completedCases.length > 0 ? 'Based on completed treatment plans' : 'No completed cases yet',
        trend: estimateAccuracy > 0 ? 'positive' : 'neutral',
        icon: 'target',
        accent: 'Estimate accuracy rate',
      },
    ],
    chart: {
      score: verifiedRate,
      completed: acceptedCases.length + completedCases.length,
      total: mappedPlans.length,
      labels: [
        {
          label: 'Booking completion rate',
          value: `${verifiedRate}%`,
          badge: verifiedRate > 75 ? 'Excellent' : 'Normal',
          badgeColor: 'success',
        },
        {
          label: 'Dispute rate',
          value: `${disputeRate}%`,
          badge: disputeRate === 0 ? 'Clean' : 'Normal',
          badgeColor: 'success',
        },
        {
          label: 'Estimate accuracy',
          value: `${estimateAccuracy}%`,
          badge: estimateAccuracy > 75 ? 'High' : 'Normal',
          badgeColor: 'sky',
        },
        {
          label: 'Profile freshness',
          value: 'Updated recently',
          badge: 'Fresh',
          badgeColor: 'success',
        },
      ],
    },
    alerts,
    activeBookings,
    referralSummary,
    referralCode,
  };
};

export const DentistService = {
  dentistProfile,
  registerDentist,
  submitProfessionalData,
  checkLicenseRegistry,
  submitLicense,
  submitOperations,
  submitClinicDepth,
  getVerificationProgress,
  getOverviewData,
};