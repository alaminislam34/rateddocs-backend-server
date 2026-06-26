import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync.js';
import { sendResponse } from '../../shared/sendResponse.js';
import { uploadToCloudinary } from '../../shared/fileUpload.js';
import { AppError } from '../../errors/AppError.js';

export const uploadSingleFile = catchAsync(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    throw new AppError(400, 'Please select a file to upload');
  }

  const result = await uploadToCloudinary(file.buffer);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'File uploaded successfully',
    data: result,
  });
});
