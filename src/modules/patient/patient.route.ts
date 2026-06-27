import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { personalizeDataSchema } from './patient.validation.js';
import { PatientController } from './patient.controller.js';
import { UserRole } from '../../generated/prisma/index.js';

const router = Router();

router.post(
  '/personalize',
  authMiddleware(UserRole.PATIENT),
  validateRequest(personalizeDataSchema),
  PatientController.PersonalizeData,
);

export const patientRoutes = router;
