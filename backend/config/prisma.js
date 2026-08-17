import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

console.log("Initializing Prisma with Pg adapter");

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const basePrisma = new PrismaClient({ adapter });

const prisma = basePrisma.$extends({
  query: {
    user: {
      async create({ args, query }) {
        if (args.data?.username && /\d/.test(args.data.username)) {
          throw new Error('Username cannot contain numbers.');
        }
        return query(args);
      },
      async update({ args, query }) {
        if (args.data?.username && /\d/.test(args.data.username)) {
          throw new Error('Username cannot contain numbers.');
        }
        return query(args);
      }
    }
  }
});

export default prisma;
