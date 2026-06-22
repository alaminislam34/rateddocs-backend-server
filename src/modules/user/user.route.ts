import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { updateProfileSchema } from './user.validation.js';
import * as userController from './user.controller.js';

const router = Router();

router.get('/me', authMiddleware, userController.getMyProfile);
router.patch('/me', authMiddleware, validateRequest(updateProfileSchema), userController.updateMyProfile);

export const userRoutes = router;
