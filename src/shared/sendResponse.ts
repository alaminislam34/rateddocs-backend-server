import { Response } from "express";

interface IResponse<T> {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export const sendResponse = async <T>(
  res: Response,
  responseData: IResponse<T>,
) => {
  const { statusCode, success, message, data, meta } = responseData;
  res.status(statusCode).json({
    statusCode,
    success,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
};