import { Router } from 'express';
import { AdminController } from './admin.controller.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { UserRole } from '../../generated/prisma/index.js';
import { updateWeightsSchema, verifyStepSchema } from './admin.validation.js';

const router = Router();

// Apply admin access control to all endpoints in this module
router.use(authMiddleware(UserRole.ADMIN, UserRole.SUPER_ADMIN));

router.get('/verifications', AdminController.getVerificationsListAdmin);

router.patch(
  '/verify-license/:dentistId',
  validateRequest(verifyStepSchema),
  AdminController.verifyLicenseAdmin,
);

router.patch(
  '/verify-operations/:dentistId',
  validateRequest(verifyStepSchema),
  AdminController.verifyOperationsAdmin,
);

router.patch(
  '/verify-clinic-depth/:dentistId',
  validateRequest(verifyStepSchema),
  AdminController.verifyClinicDepthAdmin,
);

router.get('/verification-weights', AdminController.getVerificationWeights);

router.post(
  '/verification-weights',
  validateRequest(updateWeightsSchema),
  AdminController.updateVerificationWeights,
);

export const adminRoutes = router;
