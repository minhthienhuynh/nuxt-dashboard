import type { Prisma } from '~~/prisma/generated/client'
import { prisma } from '../prisma'
import { createRepository } from './base'

const base = createRepository(prisma.host)

// Tag names → HostTag nested-create that find-or-creates each tag by its unique
// name. De-duped so a repeated name yields a single link.
const tagLinks = (names: string[]) =>
  [...new Set(names)].map(name => ({ tag: { connectOrCreate: { where: { name }, create: { name } } } }))

// Host is the aggregate root: its dependents (port-forwards, known-hosts,
// history, tag links) are managed here via nested writes rather than separate
// repositories.
export const hostRepository = {
  ...base,
  // Accept an optional `tags: string[]` (tag names) alongside the host fields and
  // turn it into HostTag links. The names are split off because tags are not a
  // Host column. Omitting `tags` writes no links; an empty array writes none.
  create: ({ tags, ...data }: Omit<Parameters<typeof base.create>[0], 'tags'> & { tags?: string[] }) =>
    prisma.host.create({
      data: { ...data, ...(tags ? { tags: { create: tagLinks(tags) } } : {}) } as Prisma.HostUncheckedCreateInput
    }),
  // Reconcile the host's tag links to exactly `tags` when provided: Prisma runs
  // the nested `deleteMany` before `create`, so the set ends equal to `tags`
  // atomically. Omitting `tags` leaves existing links untouched; `tags: []`
  // clears them all.
  update: (id: string, { tags, ...data }: Omit<Parameters<typeof base.update>[1], 'tags'> & { tags?: string[] }) =>
    prisma.host.update({
      where: { id },
      data: { ...data, ...(tags ? { tags: { deleteMany: {}, create: tagLinks(tags) } } : {}) } as Prisma.HostUncheckedUpdateInput
    }),
  // Hosts carrying ALL of the given tag names (AND). A single name degenerates
  // to the previous single-tag filter. Empty input returns no hosts — an empty
  // AND would otherwise match every host.
  findByTags: (names: string[]) =>
    names.length
      ? prisma.host.findMany({ where: { AND: names.map(name => ({ tags: { some: { tag: { name } } } })) } })
      : prisma.host.findMany({ where: { id: { in: [] } } }),
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
