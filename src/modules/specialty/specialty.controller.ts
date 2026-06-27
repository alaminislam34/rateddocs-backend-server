import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync.js';
import { sendResponse } from '../../shared/sendResponse.js';
import { SpecialtyService } from './specialty.service.js';

const getAllSpecialties = catchAsync(async (req: Request, res: Response) => {
  const { search } = req.query;

  const result = await SpecialtyService.getAllSpecialties({
    search: search ? String(search) : undefined,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Specialties retrieved successfully.',
    data: result,
  });
});

const createSpecialty = catchAsync(async (req: Request, res: Response) => {
  const result = await SpecialtyService.createSpecialty(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Specialty created successfully.',
    data: result,
  });
});

const updateSpecialty = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SpecialtyService.updateSpecialty(id as string, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Specialty updated successfully.',
    data: result,
  });
});

const deleteSpecialty = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SpecialtyService.deleteSpecialty(id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: null,
  });
});

export const SpecialtyController = {
  getAllSpecialties,
  createSpecialty,
  updateSpecialty,
  deleteSpecialty,
};
