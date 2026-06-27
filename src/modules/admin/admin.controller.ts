import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync.js';
import { sendResponse } from '../../shared/sendResponse.js';
import { AdminService } from './admin.service.js';
import { AppError } from '../../errors/AppError.js';
import status from 'http-status';

const getVerificationsListAdmin = catchAsync(async (req: Request, res: Response) => {
  const { status: verifyStatus, search, page, limit } = req.query;

  const result = await AdminService.getVerificationsListAdmin({
    status: verifyStatus ? String(verifyStatus) : undefined,
    search: search ? String(search) : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: 'Dentist verifications list retrieved successfully.',
    data: result,
  });
});

const verifyLicenseAdmin = catchAsync(async (req: Request, res: Response) => {
  const dentistId = req.params.dentistId as string;
  const { isApproved, note } = req.body;

  if (isApproved === false && (!note || typeof note !== 'string' || note.trim() === '')) {
    throw new AppError(
      status.BAD_REQUEST,
      'A note containing the rejection reason is required when rejecting verification.',
      'note',
    );
  }

  const result = await AdminService.verifyLicenseAdmin(dentistId, isApproved, note);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: 'License verification updated successfully.',
    data: result,
  });
});

const verifyOperationsAdmin = catchAsync(async (req: Request, res: Response) => {
  const dentistId = req.params.dentistId as string;
  const { isApproved, note } = req.body;

  if (isApproved === false && (!note || typeof note !== 'string' || note.trim() === '')) {
    throw new AppError(
      status.BAD_REQUEST,
      'A note containing the rejection reason is required when rejecting verification.',
      'note',
    );
  }

  const result = await AdminService.verifyOperationsAdmin(dentistId, isApproved, note);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: 'Operations verification updated successfully.',
    data: result,
  });
});

const verifyClinicDepthAdmin = catchAsync(async (req: Request, res: Response) => {
  const dentistId = req.params.dentistId as string;
  const { isApproved, note } = req.body;

  if (isApproved === false && (!note || typeof note !== 'string' || note.trim() === '')) {
    throw new AppError(
      status.BAD_REQUEST,
      'A note containing the rejection reason is required when rejecting verification.',
      'note',
    );
  }

  const result = await AdminService.verifyClinicDepthAdmin(dentistId, isApproved, note);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: 'Clinic depth verification updated successfully.',
    data: result,
  });
});

const getVerificationWeights = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getVerificationWeights();

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: 'Verification weights retrieved successfully.',
    data: result,
  });
});

const updateVerificationWeights = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.updateVerificationWeights(req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: 'Verification weights updated successfully.',
    data: result,
  });
});

export const AdminController = {
  getVerificationsListAdmin,
  verifyLicenseAdmin,
  verifyOperationsAdmin,
  verifyClinicDepthAdmin,
  getVerificationWeights,
  updateVerificationWeights,
};
