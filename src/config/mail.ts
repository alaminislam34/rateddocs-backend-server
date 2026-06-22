import nodemailer from 'nodemailer';
import { env } from './env.js';

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export const verifyMailConnection = async () => {
  try {
    await transporter.verify();
    console.log('📬 SMTP Transporter Ready');
  } catch (error) {
    console.error('❌ SMTP Connection Error:', error);
  }
};
