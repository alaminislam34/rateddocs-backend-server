import ejs from 'ejs';
import path from 'path';
import { transporter } from '../config/mail.js';
import { env } from '../config/env.js';

export const sendEmail = async (
  to: string,
  subject: string,
  templateName: string,
  templateData: Record<string, unknown>
): Promise<unknown> => {
  // Read templates from src directory using process.cwd() to keep it consistent between source and build
  const templatePath = path.join(process.cwd(), 'src/views/emails', `${templateName}.ejs`);

  // Render EJS template
  const html = await ejs.renderFile(templatePath, templateData);

  const mailOptions = {
    from: env.SMTP_FROM,
    to,
    subject,
    html,
  };

  return transporter.sendMail(mailOptions);
};
