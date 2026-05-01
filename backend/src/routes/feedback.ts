import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

type FeedbackBody = {
  category?: string;
  subject?: string;
  message?: string;
  channel?: string;
  recipientEmail?: string;
  userEmail?: string;
  userName?: string;
  companyName?: string;
  timestamp?: string;
  appVersion?: string;
};

const DEFAULT_FEEDBACK_TO = 'pve.2020@hotmail.com';

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.FEEDBACK_FROM_EMAIL?.trim() || user;
  return { host, port, secure, user, pass, from };
}

function hasSmtpConfig() {
  const cfg = getSmtpConfig();
  return Boolean(cfg.host && cfg.port && cfg.user && cfg.pass && cfg.from);
}

router.post('/send', async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as FeedbackBody;
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'subject and message are required',
      });
    }

    if (!hasSmtpConfig()) {
      return res.status(503).json({
        success: false,
        message: 'Feedback API is available but SMTP is not configured on server',
      });
    }

    const cfg = getSmtpConfig();
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
    });

    const toEmail = String(body.recipientEmail || DEFAULT_FEEDBACK_TO).trim() || DEFAULT_FEEDBACK_TO;
    const fromUser = String(body.userName || req.user?.username || 'Unknown').trim();
    const fromEmail = String(body.userEmail || req.user?.email || '').trim();
    const company = String(body.companyName || '').trim();
    const category = String(body.category || 'General').trim();
    const channel = String(body.channel || 'in-app').trim();
    const when = String(body.timestamp || new Date().toISOString()).trim();
    const appVersion = String(body.appVersion || '').trim();

    const mailSubject = `[${category}] ${subject}`;
    const text = [
      'NEW FEEDBACK',
      '============',
      `Category: ${category}`,
      `Channel: ${channel}`,
      `From: ${fromUser}${fromEmail ? ` (${fromEmail})` : ''}`,
      `Company: ${company || 'N/A'}`,
      `User ID: ${req.user?.id || 'N/A'}`,
      `Timestamp: ${when}`,
      appVersion ? `App Version: ${appVersion}` : '',
      '',
      'Message:',
      message,
    ]
      .filter(Boolean)
      .join('\n');

    await transporter.sendMail({
      from: cfg.from!,
      to: toEmail,
      replyTo: fromEmail || undefined,
      subject: mailSubject,
      text,
    });

    return res.json({
      success: true,
      message: `Feedback sent to ${toEmail}`,
    });
  } catch (error: any) {
    console.error('Feedback send failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send feedback',
      error: error?.message || 'Unknown error',
    });
  }
});

export default router;
