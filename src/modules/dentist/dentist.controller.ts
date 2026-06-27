import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync.js';
import { sendResponse } from '../../shared/sendResponse.js';
import { fromNodeHeaders } from 'better-auth/node';
import status from 'http-status';
import { DentistService } from './dentist.service.js';
import { AppError } from '../../errors/AppError.js';

/**
 * Register Dentist profile.
 */
const registerDentist = catchAsync(async (req: Request, res: Response) => {
  const result = await DentistService.registerDentist(
    req.body,
    fromNodeHeaders(req.headers),
    req.file,
  );

  if (result && 'needEmailVerify' in result && result.needEmailVerify) {
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'User is already registered but email is not verified. A verification OTP has been sent to your email.',
      data: {
        needEmailVerify: true,
        email: result.email,
      },
    });
    return;
  }

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Dentist registered successfully. A verification OTP has been sent to your email.',
    data: result,
  });
});

/**
 * Submit Dentist Professional Data.
 */
const submitProfessionalData = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const result = await DentistService.submitProfessionalData(user.id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Professional data submitted successfully.',
    data: result,
  });
});

/**
 * Check official license registry (simulated API).
 */
const checkLicenseRegistry = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  await DentistService.checkLicenseRegistry(user.id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'License number is valid in registry.',
    data: null,
  });
});

/**
 * Submit manual license certificate PDF.
 */
const submitLicense = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const licenseFile = files?.['licenseDocument']?.[0];
  const profilePictureFile = files?.['profilePicture']?.[0];

  const result = await DentistService.submitLicense(
    user.id,
    req.body,
    licenseFile,
    profilePictureFile,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'License manual verification files submitted successfully.',
    data: result,
  });
});

/**
 * Submit Dentist Operations details and custom procedures.
 */
const submitOperations = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const jciFile = files?.['jciCertificate']?.[0];
  const videoFile = files?.['walkthroughVideo']?.[0];
  const csvFile = files?.['csvFile']?.[0];

  const result = await DentistService.submitOperations(
    user.id,
    req.body,
    jciFile,
    videoFile,
    csvFile,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Operations and procedures saved successfully.',
    data: result,
  });
});

/**
 * Submit Dentist Clinic Depth verification metrics.
 */
const submitClinicDepth = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const result = await DentistService.submitClinicDepth(user.id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Clinic depth verification metrics saved successfully.',
    data: result,
  });
});

/**
 * Get current verification progress and RVD score.
 */
const getVerificationProgress = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const result = await DentistService.getVerificationProgress(user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Verification progress retrieved successfully.',
    data: result,
  });
});

const dentistProfile = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const result = await DentistService.dentistProfile(user.id);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: 'Dentist profile retrieved successfully.',
    data: result,
  });
});

export const DentistController = {
  registerDentist,
  submitProfessionalData,
  checkLicenseRegistry,
  submitLicense,
  submitOperations,
  submitClinicDepth,
  getVerificationProgress,
  dentistProfile
};