import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST || '';
const port = Number(process.env.SMTP_PORT || '587');
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
const from = process.env.SMTP_FROM || '';

export const transporter = nodemailer.createTransport({
  host,
  port,
  auth: { user, pass }
});

export async function sendEmail(to: string, subject: string, text: string) {
  if (!from) {
    throw new Error('SMTP_FROM must be set to send emails');
  }
  await transporter.sendMail({ from, to, subject, text });
}