import { prisma } from '../prisma'
import { createRepository } from './base'

// Host is the aggregate root: its dependents (port-forwards, known-hosts,
// history, tag links) are managed here via nested writes rather than separate
// repositories.
export const hostRepository = {
  ...createRepository(prisma.host),
  findByTag: (name: string) =>
    prisma.host.findMany({ where: { tags: { some: { tag: { name } } } } }),
  withRelations: (id: string) =>
    prisma.host.findUnique({
      where: { id },
      include: {
        group: true,
        identity: true,
        tags: { include: { tag: true } },
        portForwards: true,
        knownHosts: true,
        // Newest first so "recent connections" shows the latest sessions.
        history: { orderBy: { startedAt: 'desc' }, take: 10 }
      }
    })
}
