import { ZodError } from 'zod';
import status from 'http-status';
import { TGenericErrorResponse, TErrorSources } from '../interfaces/error.js';

/**
 * Formats a ZodError into a standard TGenericErrorResponse structure,
 * joining nested path fields into dot-separated strings (e.g. 'user.profile.firstName').
 */
export const handleZodError = (err: ZodError): TGenericErrorResponse => {
  const errorSources: TErrorSources[] = err.issues.map((issue) => {
    return {
      path: issue.path.join('.') || 'field',
      message: issue.message,
    };
  });

  return {
    statusCode: status.BAD_REQUEST,
    message: 'Validation Error',
    errorSources,
  };
};
