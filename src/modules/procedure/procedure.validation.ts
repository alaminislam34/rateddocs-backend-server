import { z } from 'zod';

export const createDentistProcedureSchema = z.object({
  body: z.object({
    procedureName: z.string().min(1, 'Procedure name is required'),
    price: z.number().positive('Price must be greater than 0'),
    notes: z.string().optional(),
  }),
});
