import { z } from 'zod';

export const updateWeightsSchema = z.object({
  body: z
    .object({
      licenseWeight: z.number().min(0).max(100),
      operationsWeight: z.number().min(0).max(100),
      clinicDepthWeight: z.number().min(0).max(100),
    })
    .refine(
      (data) => {
        return data.licenseWeight + data.operationsWeight + data.clinicDepthWeight === 100;
      },
      {
        message: 'The sum of all verification weights must equal exactly 100%.',
      },
    ),
});

export const verifyStepSchema = z.object({
  body: z.object({
    isApproved: z.boolean(),
    note: z.string().optional(),
  }),
});

export const verifyPhaseSchema = z.object({
  body: z.object({
    phase: z.enum(['ph1', 'ph2', 'ph3']),
    isApproved: z.boolean(),
    note: z.string().optional(),
  }),
});

