import { Router } from 'express';
import { upload } from '../../utils/fileUpload.js';
import * as fileController from './file.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const router = Router();

router.post('/upload', authMiddleware, upload.single('file'), fileController.uploadSingleFile);

export const fileRoutes = router;
