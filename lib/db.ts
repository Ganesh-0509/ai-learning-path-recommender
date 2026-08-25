import {PrismaClient} from '@/app/generated/prisma/client';
import {PrismaBetterSqlite3} from '@prisma/adapter-better-sqlite3';

// Reused across hot reloads in dev so we don't exhaust SQLite connections —
// standard Next.js + Prisma pattern.
const globalForPrisma = globalThis as unknown as {prisma?: PrismaClient};

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set — copy .env.example to .env (see docs/TRD.md §6).',
    );
  }
  const adapter = new PrismaBetterSqlite3({url});
  return new PrismaClient({adapter});
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
