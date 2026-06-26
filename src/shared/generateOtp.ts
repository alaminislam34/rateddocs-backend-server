import { prisma } from '../config/db.js';
import { sendEmail } from './sendEmail.js';

export type OTPType = 'verification' | '2fa';

export const generateAndSendOTP = async (
    email: string,
    name: string,
    type: OTPType = 'verification',
) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    const identifier = type === '2fa' ? `2fa:${email}` : `otp:${email}`;
    const subject =
        type === '2fa' ? 'RatedDocs Two-Step Login OTP' : 'Verify your RatedDocs email address';
    const template = type === '2fa' ? '2fa-otp' : 'verify-otp';

    // Delete previous verification tokens for this identifier
    await prisma.verification.deleteMany({
        where: { identifier },
    });

    // Create new verification token
    await prisma.verification.create({
        data: {
            identifier,
            value: otp,
            expiresAt,
        },
    });

    // Send verification email
    await sendEmail(email, subject, template, {
        name,
        otp,
    });
};
