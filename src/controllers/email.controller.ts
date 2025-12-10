import { Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import User from '../models/User';
import * as EmailService from '../services/email.service';
import * as Audit from '../services/audit.service';
import { getAuditContext } from '../middleware/audit';


export async function sendEmailToMe(req: AuthedRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { subject, message } = req.body as { subject?: string; message?: string };

  if (!subject || !message) {
    return res.status(400).json({ 
      message: 'subject and message are required',
      code: 'MISSING_FIELDS'
    });
  }

  if (subject.length > 200) {
    return res.status(400).json({ 
      message: 'subject must be less than 200 characters',
      code: 'SUBJECT_TOO_LONG'
    });
  }

  if (message.length > 5000) {
    return res.status(400).json({ 
      message: 'message must be less than 5000 characters',
      code: 'MESSAGE_TOO_LONG'
    });
  }

  const user = await User.findById(userId).select('email').lean();
  if (!user || !user.email) {
    return res.status(404).json({ 
      message: 'User email not found',
      code: 'USER_EMAIL_NOT_FOUND'
    });
  }

  const ctx = getAuditContext(req);

  try {
    await EmailService.sendEmail({
      to: user.email,
      subject,
      message
    });

    await Audit.log(ctx, {
      action: 'email.send',
      entity: 'Email',
      entityId: null,
      before: null,
      after: null,
      metadata: { 
        to: user.email, 
        subject,
        success: true
      }
    });

    return res.json({ 
      ok: true, 
      message: `Email sent successfully to ${user.email}`,
      data: {
        recipient: user.email,
        subject
      }
    });
  } catch (error: any) {
    await Audit.log(ctx, {
      action: 'email.send',
      entity: 'Email',
      entityId: null,
      before: null,
      after: null,
      metadata: { 
        to: user.email, 
        subject,
        success: false,
        error: error.message
      }
    });

    throw error;
  }
}

export async function checkEmailService(req: AuthedRequest, res: Response) {
  const status = EmailService.getStatus();
  const isConnected = await EmailService.verifyConnection();

  return res.json({
    ok: true,
    status: {
      ...status,
      connected: isConnected,
      healthy: status.initialized && isConnected
    }
  });
}