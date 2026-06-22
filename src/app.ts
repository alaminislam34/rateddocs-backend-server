import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { toNodeHandler } from 'better-auth/node';

import { auth } from './config/auth.js';
import { env } from './config/env.js';
import { userRoutes } from './modules/user/user.route.js';
import { fileRoutes } from './modules/file/file.route.js';
import { authRoutes } from './modules/auth/auth.route.js';
import { notFound } from './middlewares/notFound.js';
import { globalErrorHandler } from './errors/globalErrorHandler.js';
import { sendResponse } from './utils/sendResponse.js';

const app = express();

// 1. Global Pre-middleware (Security & Logging, except body parsing)
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());

// 2. Mount Better Auth (MUST be before body parsing)
app.all('/api/auth/{*splat}', toNodeHandler(auth));

// 3. Body Parsing Middleware (Safe for standard routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. API Health Check Route
app.get('/api/health-check', (req, res) => {
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'RatedDocs backend system is running smoothly',
    data: {
      timestamp: new Date(),
      env: env.NODE_ENV,
    },
  });
});

// 5. Modular API Routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/auth', authRoutes);

// 6. Not Found Catch-all Middleware
app.use(notFound);

// 7. Global Error Handler Middleware
app.use(globalErrorHandler);

export default app;
