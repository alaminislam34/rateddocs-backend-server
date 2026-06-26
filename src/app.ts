import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { toNodeHandler } from 'better-auth/node';
import path from 'path';

import { auth } from './config/auth.js';
import { envVars } from './config/env.js';
import { indexRoutes } from './routes/index.js';
import { notFound } from './middlewares/notFound.js';
import { globalErrorHandler } from './errors/globalErrorHandler.js';
import { sendResponse } from './shared/sendResponse.js';
import { prisma } from './config/db.js';
import { redisClient } from './config/redis.js';
import { transporter } from './config/mail.js';

const app = express();

// Configure EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src/views'));

// 1. Global Pre-middleware (Security & Logging, except body parsing)
app.use(
  cors({
    origin: envVars.NODE_ENV === 'production' ? false : true,
    credentials: true,
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to allow rendering of online assets/fonts in local dashboard
  }),
);

// 1.2 Mount Better Auth (MUST be before body parsing)
app.all('/api/auth/{*path}', toNodeHandler(auth));

// 2. Body Parsing Middleware (Safe for standard routes)
app.use(morgan(envVars.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());

// 3. Body Parsing Middleware (Safe for standard routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redirect root to health-check status dashboard
app.get('/', (req, res) => {
  res.redirect('/api/health-check');
});

// 4. API Health Check Route & Status Dashboard
app.get('/api/health-check', async (req, res) => {
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch {
    // Database connection failed
  }

  const redisConnected = redisClient.isOpen;

  let mailConnected = false;
  try {
    await transporter.verify();
    mailConnected = true;
  } catch {
    // Mail connection failed
  }

  // Calculate Uptime
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);
  const uptimeStr = `${h}h ${m}m ${s}s`;

  // Get Memory Usage
  const memory = `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`;

  // Render HTML dashboard for browser requests
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.render('dashboard', {
      env: envVars.NODE_ENV,
      dbConnected,
      redisConnected,
      mailConnected,
      uptime: uptimeStr,
      memory,
    });
  }

  // Return standard JSON response for API clients
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'RatedDocs backend system is running smoothly',
    data: {
      timestamp: new Date(),
      env: envVars.NODE_ENV,
      dbConnected,
      redisConnected,
      mailConnected,
      uptime: uptimeStr,
      memory,
    },
  });
});

// 5. Modular API Routes
app.use('/api/v1', indexRoutes);

// 6. Not Found Catch-all Middleware
app.use(notFound);

// 7. Global Error Handler Middleware
app.use(globalErrorHandler);

export default app;
