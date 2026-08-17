
import prisma from './config/prisma.js';
import jwt from 'jsonwebtoken';
prisma.user.findFirst().then(user => {
  if (!user) { console.log('No users found'); return process.exit(1); }
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'NQS_2026_9xK#7LmP!Qa82@bR$uT5vY');
  console.log(token);
}).catch(console.error).finally(() => process.exit(0));

