
import prisma from './config/prisma.js';
prisma.systemConfig.findMany().then(r => console.log(JSON.stringify(r, null, 2))).catch(console.error).finally(() => process.exit(0));

