import { z } from 'zod';
import { catchAsync } from '../utils/catchAsync.js';

export const validateRequest = <T extends z.ZodTypeAny>(schema: T) => {
  return catchAsync(async (req, res, next) => {
    const parsed = (await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    })) as Record<string, unknown>;

    req.body = parsed.body;
    req.query = parsed.query as Record<string, string>;
    req.params = parsed.params as Record<string, string>;
    next();
  });
};
