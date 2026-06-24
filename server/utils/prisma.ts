import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '~~/prisma/generated/client'

// Create the Prisma Client through the better-sqlite3 driver adapter (URL from DATABASE_URL).
const prismaClientSingleton = () => {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

// Cache the instance on globalThis outside production to avoid spawning a new
// connection on every Nitro/HMR module reload during development.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof prismaClientSingleton> }

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
