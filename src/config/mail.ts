import nodemailer from 'nodemailer';
import { envVars } from './env.js';

export const transporter = nodemailer.createTransport({
  host: envVars.EMAIL_SENDER_SMTP_HOST as string,
  port: Number(envVars.EMAIL_SENDER_SMTP_PORT),
  secure: Number(envVars.EMAIL_SENDER_SMTP_PORT) === 465,
  auth: {
    user: envVars.EMAIL_SENDER_SMTP_USER as string,
    pass: envVars.EMAIL_SENDER_SMTP_PASS as string,
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
