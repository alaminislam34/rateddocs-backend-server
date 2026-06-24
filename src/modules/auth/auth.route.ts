import { Router } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../../config/auth.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { loginSchema, registerPatientSchema, verifyEmailSchema } from './auth.validation.js';
import * as authController from './auth.controller.js';

const router = Router();

// Registration & Verification
router.post('/register/patient', validateRequest(registerPatientSchema), authController.registerPatient);
router.post('/verify-email', validateRequest(verifyEmailSchema), authController.verifyEmailOtp);

// Credentials Logins
router.post('/login/patient', validateRequest(loginSchema), authController.loginPatient);
router.post('/login/dentist', validateRequest(loginSchema), authController.loginDentist);
router.post('/login/admin', validateRequest(loginSchema), authController.loginAdmin);

// Google OAuth Login
router.get('/login/google', authController.initiateGoogleLogin);

// Google OAuth Callback (Handled by Better-Auth)
router.get('/login/callback/google', toNodeHandler(auth));

// Logout
router.post('/logout', authController.logout);

export const authRoutes = router;
