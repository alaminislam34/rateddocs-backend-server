import { Server } from 'http';
import app from './app.js';
import { envVars } from './config/env.js';
import { prisma } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { verifyMailConnection } from './config/mail.js';

let server: Server;

async function bootstrap() {
  try {
    // 1. Connect to PostgreSQL via Prisma
    console.log('⏳ Connecting to PostgreSQL database...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('⚡ PostgreSQL Database Connected');

    // 2. Connect to Redis
    console.log('⏳ Connecting to Redis...');
    await connectRedis();

    // 3. Verify SMTP Connection
    console.log('⏳ Verifying SMTP Connection...');
    await verifyMailConnection();

    // 4. Start HTTP Server
    server = app.listen(envVars.PORT, () => {
      console.log(`🚀 Server is running on port ${envVars.PORT} in ${envVars.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('❌ Bootstrap Error:', error);
    process.exit(1);
  }
}

bootstrap();

process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION! Shutting down...', err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION! Shutting down...', err);
  process.exit(1);
});
