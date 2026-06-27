import { ErrorRequestHandler } from 'express';
import { envVars } from '../config/env.js';
import { ZodError } from 'zod';
import status from 'http-status';
import { handleZodError } from './handleZodError.js';
import { handlePrismaError } from './handlePrismaError.js';
import { AppError } from './AppError.js';
import { TErrorSources } from '../interfaces/error.js';

interface CustomErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string>[];
  errorDetails?: unknown;
  stack?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  let statusCode: number = status.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Something went wrong! Please try again later.';
  let errors: TErrorSources[] = [];
  let errorDetails: unknown = err;

  // 1. Handle Zod validation errors
  if (err instanceof ZodError || err.name === 'ZodError') {
    const simplifiedError = handleZodError(err as ZodError);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errors = simplifiedError.errorSources;
    errorDetails = err.issues;
  }
  // 2. Handle Custom Operational AppError (with optional field/path context)
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    if (err.path) {
      errors = [
        {
          path: err.path,
          message: err.message,
        },
      ];
    }
  }
  // 3. Handle Prisma DB errors
  else if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    const simplifiedError = handlePrismaError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errors = simplifiedError.errorSources;
  }
  // 4. Fallback for non-operational/internal errors in production
  else if (envVars.NODE_ENV === 'production' && !err.isOperational) {
    message = 'An unexpected internal server error occurred.';
  }

  // Format error sources list into field-message pairs for Client Response
  const formattedErrors =
    errors.length > 0
      ? errors.map((source) => ({
        field: String(source.path),
        message: source.message,
      }))
      : undefined;

  const response: CustomErrorResponse = {
    success: false,
    message,
    ...(formattedErrors && { errors: formattedErrors }),
    ...(envVars.NODE_ENV === 'development' && {
      errorDetails,
      stack: err.stack,
    }),
  };

  res.status(statusCode).json(response);
};
