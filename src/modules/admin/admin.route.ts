import { Router } from 'express';
import { AdminController } from './admin.controller.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { UserRole } from '../../generated/prisma/index.js';
import { updateWeightsSchema, verifyStepSchema, verifyPhaseSchema } from './admin.validation.js';

const router = Router();

// Apply admin access control to all endpoints in this module
router.use(authMiddleware(UserRole.ADMIN, UserRole.SUPER_ADMIN));

router.get('/verifications', AdminController.getVerificationsListAdmin);

router.get('/dentist-verification', AdminController.getVerificationRequestsList);

router.get(
  '/dentist-verification/:dentistId',
  AdminController.getDentistVerificationPhases,
);

router.post(
  '/dentist-verification/:dentistId/approve-license',
  AdminController.approveLicensePost,
);

router.post(
  '/dentist-verification/:dentistId/approve-operation',
  AdminController.approveOperationsPost,
);

router.post(
  '/dentist-verification/:dentistId/approve-depth',
  AdminController.approveClinicDepthPost,
);

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

router.patch(
  '/verify-phase/:dentistId',
  validateRequest(verifyPhaseSchema),
  AdminController.verifyPhaseAdmin,
);

router.get('/verification-weights', AdminController.getVerificationWeights);

router.post(
  '/verification-weights',
  validateRequest(updateWeightsSchema),
  AdminController.updateVerificationWeights,
);

export const adminRoutes = router;

