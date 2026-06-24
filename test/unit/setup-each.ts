import { afterAll } from 'vitest'
import { prisma } from '../../server/utils/prisma'

// Close the better-sqlite3 connection after each test file so the worker can
// exit cleanly instead of hanging on the open handle.
afterAll(async () => {
  await prisma.$disconnect()
})
