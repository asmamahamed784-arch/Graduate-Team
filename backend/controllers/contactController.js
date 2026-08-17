import { ContactService } from '../services/contactService.js';

export const submitContactMessage = async (req, res) => {
  try {
    const data = await ContactService.submitContactMessage(req.body);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (error.message === 'All contact form fields are required') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listContactMessages = async (req, res) => {
  try {
    const data = await ContactService.listContactMessages();
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
