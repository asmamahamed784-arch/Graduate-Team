import prisma from '../config/prisma.js';
import { sendNationalIdEmail } from './emailService.js';

export class ContactService {
  static async submitContactMessage(data) {
    const { fullName, email, phone = '', message, subject } = data;

    if (!fullName || !email || !message) {
      throw new Error('All contact form fields are required');
    }

    const contactMessage = await prisma.contactMessage.create({
      data: {
        fullName,
        email,
        phone,
        message,
        subject: subject || 'National ID Contact Message'
      }
    });

    await sendNationalIdEmail({
      to: email,
      subject: 'NQS Support: National ID Contact Message',
      template: {
        heading: 'Message received',
        intro: 'We received your message and will respond within one business day.',
        rows: [
          ['Citizen name', fullName],
          ['Phone', phone],
          ['Message', message]
        ]
      }
    });

    return contactMessage;
  }

  static async listContactMessages() {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return messages;
  }
}
