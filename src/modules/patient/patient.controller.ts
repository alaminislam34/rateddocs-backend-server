import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync.js';
import { sendResponse } from '../../shared/sendResponse.js';
import { PatientService } from './patient.service.js';
import { AppError } from '../../errors/AppError.js';
import status from 'http-status';

const PersonalizeData = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
        throw new AppError(status.UNAUTHORIZED, 'Unauthorized: User session not found');
    }
    const userId = user.id;
    const payload = req.body;

    const result = await PatientService.PersonalizeData(userId, payload);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Personalization data saved successfully.',
        data: result,
    });
});

export const PatientController = {
    PersonalizeData,
};
