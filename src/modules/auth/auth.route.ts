import { Router } from 'express';
import * as authController from './auth.controller.js';

const router = Router();

router.post('/logout', authController.logout);

export const authRoutes = router;
