import type { BrandEmailContext, BrandEmailContent } from '../settings/email-template';



export type EmailType = 'invitation' | 'passwordReset' | 'otp' | 'notification' | 'invoice' | 'report' | 'emailVerification';

export interface EmailTypeData {
  invitation?: {
    inviteUrl: string;
  };
  passwordReset?: {
    resetUrl: string;
    expiresInMinutes?: number;
  };
  otp?: {
    code: string;
    expiresInMinutes?: number;
  };
  notification?: {
    headline: string;
    message: string;
    ctaUrl?: string;
    ctaLabel?: string;
  };
  invoice?: {
    invoiceNumber: string;
    amount: string;
    dueDate?: string;
    invoiceUrl?: string;
  };
  report?: {
    reportName: string;
    period?: string;
    reportUrl?: string;
  };
  emailVerification?: {
    code: string;
    expiresInHours?: number;
  };
}

export interface EmailMessage {
  subject: string;
  content: BrandEmailContent;
}

const companyOf = (brand: BrandEmailContext): string => brand.companyName || 'Business Copilot';

export function buildEmailMessage(type: EmailType, brand: BrandEmailContext, data: EmailTypeData = {}): EmailMessage {
  switch (type) {
    case 'invitation':
      return buildInvitationMessage(brand, data);
    case 'passwordReset':
      return buildPasswordResetMessage(brand, data);
    case 'otp':
      return buildOtpMessage(brand, data);
    case 'notification':
      return buildNotificationMessage(brand, data);
    case 'invoice':
      return buildInvoiceMessage(brand, data);
    case 'report':
      return buildReportMessage(brand, data);
    case 'emailVerification':
      return buildEmailVerificationMessage(brand, data);
    default:
      return buildNotificationMessage(brand, data);
  }
}

function buildInvitationMessage(brand: BrandEmailContext, data: EmailTypeData): EmailMessage {
  const inviteUrl = data.invitation?.inviteUrl ?? '';
  return {
    subject: `You're invited to join ${companyOf(brand)} on Business Copilot`,
    content: {
      title: `You're invited to join ${companyOf(brand)}`,
      body:
        `${companyOf(brand)} has invited you to join their workspace on Business Copilot. ` +
        'Set your password to activate your account and get started. This invitation link will expire after 7 days.',
      ctaLabel: 'Accept Invitation',
      ctaUrl: inviteUrl,
      footer: 'You were invited by an administrator of your organization.',
    },
  };
}

function buildPasswordResetMessage(brand: BrandEmailContext, data: EmailTypeData): EmailMessage {
  const resetUrl = data.passwordReset?.resetUrl ?? '';
  const minutes = data.passwordReset?.expiresInMinutes ?? 60;
  return {
    subject: `Reset your password for ${companyOf(brand)}`,
    content: {
      title: 'Reset your password',
      body:
        `We received a request to reset the password for your ${companyOf(brand)} account. ` +
        `If you made this request, choose a new password using the button below. This link expires in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      ctaLabel: 'Reset Password',
      ctaUrl: resetUrl,
      footer: 'If you did not request a password reset, you can safely ignore this email.',
    },
  };
}

function buildOtpMessage(brand: BrandEmailContext, data: EmailTypeData): EmailMessage {
  const minutes = data.otp?.expiresInMinutes ?? 10;
  return {
    subject: `Your ${companyOf(brand)} verification code`,
    content: {
      title: 'Your verification code',
      body:
        `Use the verification code below to continue signing in to ${companyOf(brand)}. ` +
        `This code expires in ${minutes} minute${minutes === 1 ? '' : 's'} and can only be used once.`,
      code: data.otp?.code ?? '',
      ctaLabel: undefined,
      ctaUrl: undefined,
      footer: 'Never share this code with anyone. Business Copilot will never ask for it.',
    },
  };
}

function buildNotificationMessage(brand: BrandEmailContext, data: EmailTypeData): EmailMessage {
  const headline = data.notification?.headline ?? 'New update';
  const message = data.notification?.message ?? '';
  return {
    subject: `${headline} — ${companyOf(brand)}`,
    content: {
      title: headline,
      body: message,
      ctaLabel: data.notification?.ctaLabel,
      ctaUrl: data.notification?.ctaUrl,
      footer: data.notification?.ctaUrl ? undefined : 'No action needed.',
    },
  };
}

function buildInvoiceMessage(brand: BrandEmailContext, data: EmailTypeData): EmailMessage {
  const invoiceNumber = data.invoice?.invoiceNumber ?? '';
  const amount = data.invoice?.amount ?? '';
  const dueDate = data.invoice?.dueDate;
  const dueText = dueDate ? ` It is due by ${dueDate}.` : '';
  return {
    subject: `Invoice ${invoiceNumber} from ${companyOf(brand)}`,
    content: {
      title: `Invoice ${invoiceNumber}`,
      body: `Your invoice from ${companyOf(brand)} is ready. Total due: ${amount}.${dueText}`,
      ctaLabel: data.invoice?.invoiceUrl ? 'View Invoice' : undefined,
      ctaUrl: data.invoice?.invoiceUrl,
      footer: 'For questions about this invoice, contact your account representative.',
    },
  };
}

function buildReportMessage(brand: BrandEmailContext, data: EmailTypeData): EmailMessage {
  const reportName = data.report?.reportName ?? 'Report';
  const period = data.report?.period ? ` for ${data.report.period}` : '';
  return {
    subject: `${reportName}${period} — ${companyOf(brand)}`,
    content: {
      title: reportName,
      body: `Your ${reportName}${period} is ready to review.`,
      ctaLabel: data.report?.reportUrl ? 'View Report' : undefined,
      ctaUrl: data.report?.reportUrl,
      footer: 'Generated by Business Copilot.',
    },
  };
}

function buildEmailVerificationMessage(brand: BrandEmailContext, data: EmailTypeData): EmailMessage {
  const code = data.emailVerification?.code ?? '';
  const hours = data.emailVerification?.expiresInHours ?? 24;
  const minutes = Math.max(1, Math.round(hours * 60));
  return {
    subject: `Verify your email for ${companyOf(brand)}`,
    content: {
      title: 'Verify your email address',
      body:
        `Thanks for creating a ${companyOf(brand)} account. Use the 6-digit verification code below to verify your email. ` +
        `This code expires in ${minutes} minute${minutes === 1 ? '' : 's'} and can only be used once.`,
      code,
      ctaLabel: undefined,
      ctaUrl: undefined,
      footer: 'If you did not create an account, you can safely ignore this email.',
    },
  };
}

/** Plain-text fallback built from the same content so every email has both. */
export function buildEmailText(message: EmailMessage): string {
  const lines: string[] = [message.content.title, ''];
  if (message.content.body) {
    lines.push(message.content.body, '');
  }
  if (message.content.ctaUrl) {
    lines.push(`${message.content.ctaLabel ?? 'Open'}`, message.content.ctaUrl, '');
  }
  if (message.content.footer) {
    lines.push(message.content.footer);
  }
  return lines.join('\n');
}
