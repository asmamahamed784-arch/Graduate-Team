const Notification = require('../models/Notification');

// Mock notification sender
const sendNotification = async (recipientId, type, title, message) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      type,
      title,
      message,
      status: 'pending'
    });

    // Here you would integrate with SMS gateway (e.g., Twilio) or Email (e.g., SendGrid)
    // For now, we simulate sending:
    console.log(`[SIMULATED ${type}] To: ${recipientId} | Title: ${title} | Message: ${message}`);
    
    notification.status = 'sent';
    notification.sentAt = Date.now();
    await notification.save();

    return notification;
  } catch (error) {
    console.error('Notification Error:', error.message);
  }
};

module.exports = {
  sendNotification
};
