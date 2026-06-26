import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { envVars } from './env.js';

const pool = new pg.Pool({ connectionString: envVars.DATABASE_URL as string });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
