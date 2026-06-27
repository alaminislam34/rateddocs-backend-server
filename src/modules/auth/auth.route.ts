import { Router } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../../config/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import {
  loginSchema,
  registerPatientSchema,
  verifyEmailSchema,
  resendOtpSchema,
} from './auth.validation.js';
import { AuthController } from './auth.controller.js';

const router = Router();

router.post(
  '/register/patient',
  validateRequest(registerPatientSchema),
  AuthController.registerPatient,
);
router.post('/verify-email', validateRequest(verifyEmailSchema), AuthController.verifyEmailOtp);

router.post('/login', validateRequest(loginSchema), AuthController.loginUser);

router.post('/login/admin', validateRequest(loginSchema), AuthController.loginAdmin);

router.post('/verify-2fa', validateRequest(verifyEmailSchema), AuthController.verify2faOtp);

router.post('/resend-otp', validateRequest(resendOtpSchema), AuthController.resendOtp);

// Google OAuth Login
router.get('/login/google', AuthController.initiateGoogleLoginController);

// Google OAuth Callback (Handled by Better-Auth)
router.get('/login/callback/google', toNodeHandler(auth));

router.get('/current-user-session', AuthController.getSession);

router.post('/logout', AuthController.logout);

export const authRoutes = router;
