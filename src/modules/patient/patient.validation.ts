import { z } from 'zod';
import { Gender } from '../../generated/prisma/index.js';

export const personalizeDataSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    gender: z.nativeEnum(Gender),
    phoneNumber: z.string().min(1, 'Phone number is required'),
    dateOfBirth: z.preprocess((arg) => {
      if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    }, z.date()),
    country: z.string().min(1, 'Country is required'),
    preferedProcedureId: z.string().min(1, 'Preferred procedure ID is required'),
    preferedBudget: z.number().positive('Preferred budget must be a positive number'),
    travelTime: z
      .object({
        fromDate: z.preprocess((arg) => {
          if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
        }, z.date()),
        toDate: z.preprocess((arg) => {
          if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
        }, z.date()),
        maxDistance: z.number().positive('Max distance must be positive'),
      })
      .optional(),
  }),
});
