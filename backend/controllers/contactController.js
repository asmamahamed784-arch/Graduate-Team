import ContactMessage from '../models/ContactMessage.js';
import { sendNationalIdEmail } from '../services/emailService.js';

export const submitContactMessage = async (req, res) => {
  try {
    const { fullName, email, phone, message } = req.body;

    if (!fullName || !email || !phone || !message) {
      return res.status(400).json({ success: false, message: 'All contact form fields are required' });
    }

    const contactMessage = await ContactMessage.create({
      fullName,
      email,
      phone,
      message,
      subject: 'National ID Contact Message'
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

    return res.status(201).json({ success: true, data: contactMessage });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listContactMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find({}).sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, count: messages.length, data: messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
