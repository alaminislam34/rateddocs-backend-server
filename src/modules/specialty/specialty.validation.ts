import { z } from 'zod';

export const createSpecialtySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().optional(),
  }),
});

export const updateSpecialtySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name cannot be empty').max(255).optional(),
    description: z.string().optional(),
  }),
});
