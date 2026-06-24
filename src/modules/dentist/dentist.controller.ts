import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import { fromNodeHeaders } from 'better-auth/node';
import * as dentistService from './dentist.service.js';
import { AppError } from '../../errors/AppError.js';
import status from 'http-status';

/**
 * Register Dentist profile.
 */
export const registerDentist = catchAsync(async (req: Request, res: Response) => {
  const result = await dentistService.registerDentist(req.body, fromNodeHeaders(req.headers), req.file);

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
export const submitProfessionalData = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const result = await dentistService.submitProfessionalData(user.id, req.body);

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
export const checkLicenseRegistry = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  await dentistService.checkLicenseRegistry(user.id, req.body);

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
export const submitLicense = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const licenseFile = files?.['licenseDocument']?.[0];
  const profilePictureFile = files?.['profilePicture']?.[0];

  const result = await dentistService.submitLicense(user.id, req.body, licenseFile, profilePictureFile);

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
export const submitOperations = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const jciFile = files?.['jciCertificate']?.[0];
  const videoFile = files?.['walkthroughVideo']?.[0];
  const csvFile = files?.['csvFile']?.[0];

  const result = await dentistService.submitOperations(user.id, req.body, jciFile, videoFile, csvFile);

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
export const submitClinicDepth = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const result = await dentistService.submitClinicDepth(user.id, req.body);

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
export const getVerificationProgress = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const result = await dentistService.getVerificationProgress(user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Verification progress retrieved successfully.',
    data: result,
  });
});

/**
 * Admin: Approve/Reject Dentist License document (30% RVD)
 */
export const verifyLicenseAdmin = catchAsync(async (req: Request, res: Response) => {
  const dentistId = req.params.dentistId as string;
  const { isApproved, note } = req.body;

  if (typeof isApproved !== 'boolean') {
    throw new AppError(status.BAD_REQUEST, 'isApproved field must be a boolean');
  }

  if (isApproved === false && (!note || typeof note !== 'string' || note.trim() === '')) {
    throw new AppError(status.BAD_REQUEST, 'A note containing the rejection reason is required when rejecting verification.', 'note');
  }

  const result = await dentistService.verifyLicenseAdmin(dentistId, isApproved, note);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'License verification updated successfully.',
    data: result,
  });
});

/**
 * Admin: Approve/Reject Dentist Operations (40% RVD)
 */
export const verifyOperationsAdmin = catchAsync(async (req: Request, res: Response) => {
  const dentistId = req.params.dentistId as string;
  const { isApproved, note } = req.body;

  if (typeof isApproved !== 'boolean') {
    throw new AppError(status.BAD_REQUEST, 'isApproved field must be a boolean');
  }

  if (isApproved === false && (!note || typeof note !== 'string' || note.trim() === '')) {
    throw new AppError(status.BAD_REQUEST, 'A note containing the rejection reason is required when rejecting verification.', 'note');
  }

  const result = await dentistService.verifyOperationsAdmin(dentistId, isApproved, note);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Operations verification updated successfully.',
    data: result,
  });
});

/**
 * Admin: Approve/Reject Dentist Clinic Depth (30% RVD)
 */
export const verifyClinicDepthAdmin = catchAsync(async (req: Request, res: Response) => {
  const dentistId = req.params.dentistId as string;
  const { isApproved, note } = req.body;

  if (typeof isApproved !== 'boolean') {
    throw new AppError(status.BAD_REQUEST, 'isApproved field must be a boolean');
  }

  if (isApproved === false && (!note || typeof note !== 'string' || note.trim() === '')) {
    throw new AppError(status.BAD_REQUEST, 'A note containing the rejection reason is required when rejecting verification.', 'note');
  }

  const result = await dentistService.verifyClinicDepthAdmin(dentistId, isApproved, note);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Clinic depth verification updated successfully.',
    data: result,
  });
});

/**
 * Admin: Retrieve all dentist verification requests with search, filter, and pagination
 */
export const getVerificationsListAdmin = catchAsync(async (req: Request, res: Response) => {
  const { status: verifyStatus, search, page, limit } = req.query;

  const result = await dentistService.getVerificationsListAdmin({
    status: verifyStatus ? String(verifyStatus) : undefined,
    search: search ? String(search) : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Dentist verifications list retrieved successfully.',
    data: result,
  });
});
