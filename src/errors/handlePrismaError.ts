import status from 'http-status';
import { TGenericErrorResponse, TErrorSources } from '../interfaces/error.js';

interface PrismaErrorMeta {
  target?: string[];
  cause?: string;
}

interface PrismaErrorLike {
  code: string;
  message: string;
  meta?: PrismaErrorMeta;
}

/**
 * Parses and formats Prisma database errors into a standard TGenericErrorResponse.
 */
export const handlePrismaError = (err: PrismaErrorLike): TGenericErrorResponse => {
  let statusCode: number = status.INTERNAL_SERVER_ERROR;
  let message: string;
  let errorSources: TErrorSources[];

  if (err.code === 'P2002') {
    statusCode = status.CONFLICT;
    const targetFields = err.meta?.target ? err.meta.target.join(', ') : 'field';
    const capitalizedField = targetFields.charAt(0).toUpperCase() + targetFields.slice(1);
    message = `${capitalizedField} already exists. Please use a different value.`;
    
    errorSources = (err.meta?.target || ['field']).map((field) => ({
      path: field,
      message: `${field} must be unique`,
    }));
  } else if (err.code === 'P2003') {
    statusCode = status.BAD_REQUEST;
    message = 'Failed to save data due to an invalid relation constraint.';
    errorSources = [
      {
        path: 'relation',
        message: 'Invalid relation constraint in database',
      },
    ];
  } else if (err.code === 'P2025') {
    statusCode = status.NOT_FOUND;
    message = err.meta?.cause || 'The requested record was not found.';
    errorSources = [
      {
        path: 'id',
        message,
      },
    ];
  } else {
    message = `Database Error (${err.code}): ${err.message}`;
    errorSources = [
      {
        path: 'database',
        message: err.message,
      },
    ];
  }

  return {
    statusCode,
    message,
    errorSources,
  };
};
