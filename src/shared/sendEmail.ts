import ejs from 'ejs';
import path from 'path';
import { transporter } from '../config/mail.js';
import { envVars } from '../config/env.js';

export const sendEmail = async (
  to: string,
  subject: string,
  templateName: string,
  templateData: Record<string, unknown>,
): Promise<unknown> => {
  const templatePath = path.join(process.cwd(), 'src/views/emails', `${templateName}.ejs`);

  const html = await ejs.renderFile(templatePath, templateData);

  const mailOptions = {
    from: envVars.EMAIL_SENDER_SMTP_FROM as string,
    to,
    subject,
    html,
  };

  return transporter.sendMail(mailOptions);
};
