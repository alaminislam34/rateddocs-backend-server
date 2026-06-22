import { Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync.js';
import { sendResponse } from '../../utils/sendResponse.js';
import * as userService from './user.service.js';
import { AppError } from '../../errors/AppError.js';

export const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'Unauthorized');
  }

  const user = await userService.getUserById(userId);
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User profile retrieved successfully',
    data: user,
  });
});

export const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'Unauthorized');
  }

  const updatedUser = await userService.updateUser(userId, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'User profile updated successfully',
    data: updatedUser,
  });
});
