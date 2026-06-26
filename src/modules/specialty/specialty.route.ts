import { Router } from 'express';
import { SpecialtyController } from './specialty.controller.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { UserRole } from '../../generated/prisma/index.js';
import { createSpecialtySchema, updateSpecialtySchema } from './specialty.validation.js';

const router = Router();

// Public route to list specialties
router.get('/', SpecialtyController.getAllSpecialties);

// Admin-only management routes
router.post(
  '/',
  authMiddleware(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(createSpecialtySchema),
  SpecialtyController.createSpecialty,
);

router.patch(
  '/:id',
  authMiddleware(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(updateSpecialtySchema),
  SpecialtyController.updateSpecialty,
);

router.delete(
  '/:id',
  authMiddleware(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  SpecialtyController.deleteSpecialty,
);

export const specialtyRoutes = router;
