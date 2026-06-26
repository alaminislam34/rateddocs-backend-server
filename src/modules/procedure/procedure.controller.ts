import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync.js';
import { sendResponse } from '../../shared/sendResponse.js';
import { ProcedureService } from './procedure.service.js';
import { AppError } from '../../errors/AppError.js';
import status from 'http-status';

const getGlobalProcedures = catchAsync(async (req: Request, res: Response) => {
  const { search } = req.query;

  const result = await ProcedureService.getGlobalProcedures({
    search: search ? String(search) : undefined,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Global procedures retrieved successfully.',
    data: result,
  });
});

const getDentistProcedures = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const result = await ProcedureService.getDentistProcedures(user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Dentist procedures retrieved successfully.',
    data: result,
  });
});

const createDentistProcedure = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const result = await ProcedureService.createDentistProcedure(user.id, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Dentist procedure created successfully.',
    data: result,
  });
});

const deleteDentistProcedure = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const { id } = req.params;
  const result = await ProcedureService.deleteDentistProcedure(user.id, id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: null,
  });
});

const bulkUploadDentistProcedures = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
  }

  const result = await ProcedureService.bulkUploadDentistProcedures(user.id, req.file);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: { count: result.count },
  });
});

export const ProcedureController = {
  getGlobalProcedures,
  getDentistProcedures,
  createDentistProcedure,
  deleteDentistProcedure,
  bulkUploadDentistProcedures,
};
