import Ticket from '../models/Ticket.js';

export const generateRef = async () => {
  const prefixes = ["NQS-10", "NQS-30", "NQS-50", "NQS-70", "NQS-90"];
  let isUnique = false;
  let reference = "";

  while (!isUnique) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomDigits = Math.floor(Math.random() * 90 + 10);
    reference = `${prefix}${randomDigits}`;

    const exists = await Ticket.findOne({ ref: reference });
    if (!exists) {
      isUnique = true;
    }
  }

  return reference;
};
