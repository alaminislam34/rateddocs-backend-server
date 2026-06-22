import { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';
import { ZodError } from 'zod';

interface CustomErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string>[];
  errorDetails?: unknown;
  stack?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong! Please try again later.';
  let errors: Record<string, string>[] | undefined = undefined;
  let errorDetails: unknown = err;

  // 1. Handle Zod validation errors
  if (err instanceof ZodError || err.name === 'ZodError') {
    statusCode = 400;
    const zodError = err as ZodError;
    
    // Map errors into a clean, readable list
    errors = zodError.issues.map((issue) => {
      // slice off the root element (e.g. 'body', 'query', 'params') to keep error paths neat
      const fieldPath = issue.path.length > 1 ? issue.path.slice(1).join('.') : issue.path.join('.');
      return {
        field: fieldPath || 'field',
        message: issue.message,
      };
    });
    
    // Join messages for a unified user-friendly main message
    const joinedMessages = zodError.issues.map((issue) => issue.message).join(', ');
    message = `Validation failed: ${joinedMessages}`;
    errorDetails = zodError.issues;
  }

  // 2. Handle Prisma errors
  else if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    // Unique constraint violation (P2002)
    if (err.code === 'P2002') {
      statusCode = 409;
      const targetFields = err.meta?.target
        ? (err.meta.target as string[]).join(', ')
        : 'field';
      const capitalizedField = targetFields.charAt(0).toUpperCase() + targetFields.slice(1);
      message = `${capitalizedField} already exists. Please use a different value.`;
    }
    // Foreign key constraint violation (P2003)
    else if (err.code === 'P2003') {
      statusCode = 400;
      message = 'Failed to save data due to an invalid relation constraint.';
    }
    // Record not found (P2025)
    else if (err.code === 'P2025') {
      statusCode = 404;
      message = (err.meta?.cause as string) || 'The requested record was not found.';
    }
    // General Prisma database error fallback
    else {
      statusCode = 500;
      message = env.NODE_ENV === 'production'
        ? 'A database error occurred.'
        : `Database Error (${err.code}): ${err.message}`;
    }
  }

  // 3. General Server/Syntax errors fallback in production
  else if (env.NODE_ENV === 'production' && !err.isOperational) {
    message = 'An unexpected internal server error occurred.';
  }

  const response: CustomErrorResponse = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(env.NODE_ENV === 'development' && {
      errorDetails,
      stack: err.stack,
    }),
  };

  res.status(statusCode).json(response);
};
