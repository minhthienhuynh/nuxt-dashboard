import { prisma } from '../../server/utils/prisma'

// Clear all domain rows between tests. Order respects foreign keys: host
// dependents first, then hosts, then the shared entities they referenced.
export async function resetDb() {
  await prisma.connectionHistory.deleteMany()
  await prisma.portForward.deleteMany()
  await prisma.knownHost.deleteMany()
  await prisma.hostTag.deleteMany()
  await prisma.snippet.deleteMany()
  await prisma.host.deleteMany()
  await prisma.identity.deleteMany()
  await prisma.sSHKey.deleteMany()
  await prisma.group.deleteMany()
  await prisma.tag.deleteMany()
}

export { prisma }
