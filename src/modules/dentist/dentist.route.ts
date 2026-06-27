import { Router } from 'express';
import { DentistController } from './dentist.controller.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { UserRole } from '../../generated/prisma/index.js';
import { upload } from '../../shared/fileUpload.js';
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
  DentistController.registerDentist,
);

// Dentist Protected Routes
router.post(
  '/professional-data',
  authMiddleware(UserRole.DENTIST),
  validateRequest(submitProfessionalDataSchema),
  DentistController.submitProfessionalData,
);

router.post(
  '/verify-license/check',
  authMiddleware(UserRole.DENTIST),
  validateRequest(checkLicenseSchema),
  DentistController.checkLicenseRegistry,
);

router.post(
  '/verify-license/submit',
  authMiddleware(UserRole.DENTIST),
  upload.fields([
    { name: 'licenseDocument', maxCount: 1 },
    { name: 'profilePicture', maxCount: 1 },
  ]),
  validateRequest(submitLicenseSchema),
  DentistController.submitLicense,
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
  DentistController.submitOperations,
);

router.post(
  '/verify-clinic-depth/submit',
  authMiddleware(UserRole.DENTIST),
  validateRequest(submitClinicDepthSchema),
  DentistController.submitClinicDepth,
);

router.get(
  '/progress',
  authMiddleware(UserRole.DENTIST),
  DentistController.getVerificationProgress,
);

router.get(
  '/overview',
  authMiddleware(UserRole.DENTIST),
  DentistController.getOverviewData,
);

router.get("/profile", authMiddleware(UserRole.DENTIST), DentistController.dentistProfile)

export const dentistRoutes = router;
