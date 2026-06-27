export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;
  public readonly path?: string;

  constructor(
    statusCode: number,
    message: string,
    path?: string,
    stack?: string,
    errorCode?: string,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.path = path;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
