import prisma from './config/prisma.js';
import bcrypt from 'bcryptjs';

async function run() {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('Admin@123', salt);

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      name: 'System Admin'
    },
    create: {
      username: 'admin',
      name: 'System Admin',
      password: hashedPassword,
      role: 'admin',
      status: 'active'
    }
  });

  console.log("Admin user ready!");
  console.log("Username: admin");
  console.log("Password: Admin@123");
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
