import { Router } from 'express';
import * as dentistController from './dentist.controller.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { UserRole } from '../../generated/prisma/index.js';
import { upload } from '../../utils/fileUpload.js';
import {
  registerDentistSchema,
  submitProfessionalDataSchema,
  checkLicenseSchema,
  submitLicenseSchema,
  submitOperationsSchema,
  submitClinicDepthSchema,
} from './dentist.validation.js';

const router = Router();

// Public Dentist Registration Route
router.post(
  '/register',
  upload.single('image'),
  validateRequest(registerDentistSchema),
  dentistController.registerDentist
);

// Dentist Protected Routes
router.post(
  '/professional-data',
  authMiddleware(UserRole.DENTIST),
  validateRequest(submitProfessionalDataSchema),
  dentistController.submitProfessionalData
);

router.post(
  '/verify-license/check',
  authMiddleware(UserRole.DENTIST),
  validateRequest(checkLicenseSchema),
  dentistController.checkLicenseRegistry
);

router.post(
  '/verify-license/submit',
  authMiddleware(UserRole.DENTIST),
  upload.fields([
    { name: 'licenseDocument', maxCount: 1 },
    { name: 'profilePicture', maxCount: 1 },
  ]),
  validateRequest(submitLicenseSchema),
  dentistController.submitLicense
);

router.post(
  '/verify-operations/submit',
  authMiddleware(UserRole.DENTIST),
  upload.fields([
    { name: 'jciCertificate', maxCount: 1 },
    { name: 'walkthroughVideo', maxCount: 1 },
    { name: 'csvFile', maxCount: 1 },
  ]),
  validateRequest(submitOperationsSchema),
  dentistController.submitOperations
);

router.post(
  '/verify-clinic-depth/submit',
  authMiddleware(UserRole.DENTIST),
  validateRequest(submitClinicDepthSchema),
  dentistController.submitClinicDepth
);

router.get(
  '/progress',
  authMiddleware(UserRole.DENTIST),
  dentistController.getVerificationProgress
);

// Admin/Super Admin Verification Controls
router.get(
  '/admin/verifications',
  authMiddleware(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  dentistController.getVerificationsListAdmin
);

router.patch(
  '/admin/verify-license/:dentistId',
  authMiddleware(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  dentistController.verifyLicenseAdmin
);

router.patch(
  '/admin/verify-operations/:dentistId',
  authMiddleware(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  dentistController.verifyOperationsAdmin
);

router.patch(
  '/admin/verify-clinic-depth/:dentistId',
  authMiddleware(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  dentistController.verifyClinicDepthAdmin
);

export const dentistRoutes = router;
