import prisma from '../config/prisma.js';

export const generateRef = async () => {
  let isUnique = false;
  let reference = "";

  while (!isUnique) {
    const randomDigits = Math.floor(Math.random() * 9000 + 1000);
    reference = `REQ-${randomDigits}`;

    const exists = await prisma.ticket.findUnique({ where: { ref: reference } });
    if (!exists) {
      isUnique = true;
    }
  }

  return reference;
};
