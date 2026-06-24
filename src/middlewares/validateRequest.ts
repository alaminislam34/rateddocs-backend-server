import { z } from 'zod';
import { catchAsync } from '../utils/catchAsync.js';

export const validateRequest = <T extends z.ZodTypeAny>(schema: T) => {
  return catchAsync(async (req, res, next) => {
    const parsed = (await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    })) as Record<string, unknown>;

    if (parsed.body !== undefined) {
      req.body = parsed.body;
    }
    if (parsed.query !== undefined) {
      Object.assign(req.query, parsed.query);
    }
    if (parsed.params !== undefined) {
      Object.assign(req.params, parsed.params);
    }
    next();
  });
};
