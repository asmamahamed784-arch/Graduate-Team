import nodemailer from 'nodemailer';
import EmailLog from '../models/EmailLog.js';

const requiredSmtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

const hasSmtpConfig = () => requiredSmtpKeys.every((key) => Boolean(process.env[key]));

const safeLogEmail = async ({ recipient, subject, content, status }) => {
  try {
    return await EmailLog.create({
      recipient,
      subject,
      content,
      status
    });
  } catch (error) {
    console.error(`Email log could not be saved: ${error.message}`);
    return null;
  }
};

const getQueueNumber = (ticket) => {
  const reference = ticket?.ref || ticket?.ticketRef || ticket?.reference;
  return reference ? reference.split('-').pop() : 'Not assigned';
};

const formatDate = (value) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const renderRows = (rows) => rows
  .filter(([, value]) => value !== undefined && value !== null && value !== '')
  .map(([label, value]) => `
    <tr>
      <td style="padding:10px 0;color:#64748b;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(value)}</td>
    </tr>
  `)
  .join('');

const renderTemplate = ({ heading, intro, rows }) => `
  <!doctype html>
  <html>
    <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
        <div style="background:#0B1220;border-radius:18px 18px 0 0;padding:24px 28px;color:#ffffff;">
          <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#60a5fa;">
            NQS National ID
          </div>
          <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;">${escapeHtml(heading)}</h1>
        </div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 18px 18px;padding:28px;">
          <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.7;">${escapeHtml(intro)}</p>
          <table style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
            ${renderRows(rows)}
          </table>
          <p style="margin:22px 0 0;color:#475569;font-size:14px;line-height:1.7;">
            Please keep your ticket reference safe and bring the required documents when you visit the selected Banaadir National ID center.
          </p>
          <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
            This is an automated message from the National Queue System for National ID services.
          </p>
        </div>
      </div>
    </body>
  </html>
`;

const renderText = ({ heading, intro, rows }) => {
  const details = rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');

  return `${heading}\n\n${intro}\n\n${details}\n\nPlease keep your ticket reference safe and bring the required documents when you visit the selected Banaadir National ID center.`;
};

const createTransporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const sendNationalIdEmail = async ({ to, subject, template }) => {
  if (!to) return null;

  const html = renderTemplate(template);
  const text = renderText(template);

  if (!hasSmtpConfig()) {
    return safeLogEmail({
      recipient: to,
      subject,
      content: `${text}\n\nDelivery skipped: SMTP credentials are not configured.`,
      status: 'Failed'
    });
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
      text
    });

    return safeLogEmail({
      recipient: to,
      subject,
      content: html,
      status: 'Sent'
    });
  } catch (error) {
    return safeLogEmail({
      recipient: to,
      subject,
      content: `${text}\n\nDelivery error: ${error.message}`,
      status: 'Failed'
    });
  }
};

const ticketRows = ({ citizenName, ticket, service, center, appointmentDate, timeSlot }) => [
  ['Citizen name', citizenName || ticket?.citizenName || 'Citizen'],
  ['Ticket number', ticket?.ref || 'Not assigned'],
  ['Service', service?.name || 'National ID Registration'],
  ['Center', center?.name || center || 'Not selected'],
  ['Appointment date', formatDate(appointmentDate || ticket?.date)],
  ['Time', timeSlot || ticket?.timeSlot || 'Not selected'],
  ['Queue number', getQueueNumber(ticket)],
  ['Ticket reference', ticket?.ref || 'Not assigned']
];

export const sendRegistrationEmail = (user) => sendNationalIdEmail({
  to: user.email,
  subject: 'Welcome to the National ID Appointment System',
  template: {
    heading: 'Your account has been created',
    intro: `Hello ${user.name}, your citizen account is ready. You can now book a National ID appointment and track your queue ticket online.`,
    rows: [
      ['Citizen name', user.name],
      ['Email', user.email],
      ['Phone', user.phone || 'Not provided']
    ]
  }
});

export const sendBookingConfirmationEmail = ({ user, ticket, service, center }) => sendNationalIdEmail({
  to: user.email,
  subject: `National ID Appointment Confirmed - ${ticket.ref}`,
  template: {
    heading: 'Appointment confirmed',
    intro: `Hello ${user.name}, your National ID appointment has been confirmed.`,
    rows: ticketRows({ citizenName: user.name, ticket, service, center })
  }
});

export const sendQueueTicketGeneratedEmail = ({ to, citizenName, ticket, service, center }) => sendNationalIdEmail({
  to,
  subject: `Queue Ticket Generated - ${ticket.ref}`,
  template: {
    heading: 'Queue ticket generated',
    intro: `Hello ${citizenName || 'Citizen'}, your National ID queue ticket has been generated.`,
    rows: ticketRows({ citizenName, ticket, service, center })
  }
});

export const sendAppointmentApprovalEmail = ({ user, ticket, service, center }) => sendNationalIdEmail({
  to: user.email,
  subject: `National ID Appointment Approved - ${ticket.ref}`,
  template: {
    heading: 'Appointment approved',
    intro: `Hello ${user.name}, your National ID appointment has been approved.`,
    rows: ticketRows({ citizenName: user.name, ticket, service, center })
  }
});

export const sendAppointmentCancellationEmail = ({ user, ticket, service, center }) => sendNationalIdEmail({
  to: user.email,
  subject: `National ID Appointment Cancelled - ${ticket.ref}`,
  template: {
    heading: 'Appointment cancelled',
    intro: `Hello ${user.name}, your National ID appointment has been cancelled.`,
    rows: ticketRows({ citizenName: user.name, ticket, service, center })
  }
});

export const sendAppointmentCompletionEmail = ({ user, ticket, service, center }) => sendNationalIdEmail({
  to: user.email,
  subject: `National ID Appointment Completed - ${ticket.ref}`,
  template: {
    heading: 'Appointment completed',
    intro: `Hello ${user.name}, your National ID service visit has been completed.`,
    rows: ticketRows({ citizenName: user.name, ticket, service, center })
  }
});
