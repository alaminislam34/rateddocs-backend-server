import { Router } from 'express';
import { ProcedureController } from './procedure.controller.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { UserRole } from '../../generated/prisma/index.js';
import { createDentistProcedureSchema } from './procedure.validation.js';
import { upload } from '../../shared/fileUpload.js';

const router = Router();

// Public / Global route to search global procedures
router.get('/global', ProcedureController.getGlobalProcedures);

// Dentist protected routes for managing procedures
router.get('/dentist', authMiddleware(UserRole.DENTIST), ProcedureController.getDentistProcedures);

router.post(
  '/dentist',
  authMiddleware(UserRole.DENTIST),
  validateRequest(createDentistProcedureSchema),
  ProcedureController.createDentistProcedure,
);

router.delete(
  '/dentist/:id',
  authMiddleware(UserRole.DENTIST),
  ProcedureController.deleteDentistProcedure,
);

router.post(
  '/dentist/csv',
  authMiddleware(UserRole.DENTIST),
  upload.single('csvFile'),
  ProcedureController.bulkUploadDentistProcedures,
);

export const procedureRoutes = router;
