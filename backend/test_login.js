import prisma from './config/prisma.js';

async function run() {
  const user = await prisma.user.findUnique({
    where: { username: 'admin' }
  });
  console.log("Prisma findUnique user:", user);
}
run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
