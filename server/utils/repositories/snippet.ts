import type { Prisma } from '~~/prisma/generated/client'
import { prisma } from '../prisma'
import { createRepository } from './base'

const base = createRepository(prisma.snippet)

// Snippet scope is expressed via SnippetHost join rows. Reads always include the
// host links so callers can render/edit the scope.
const withLinks = { hosts: true } satisfies Prisma.SnippetInclude

// Turn a host-id array into nested-create link rows. De-duped so a repeated id
// yields a single link.
const hostLinks = (ids: string[]) => [...new Set(ids)].map(hostId => ({ hostId }))

// A snippet with no host links is global; host links scope it to those hosts.
// Grouping is a UI-only convenience (the form expands a group to its hosts), so
// there is no persisted group relation here.
export const snippetRepository = {
  ...base,

  findMany: () => prisma.snippet.findMany({ include: withLinks, orderBy: { createdAt: 'desc' } }),

  findById: (id: string) => prisma.snippet.findUnique({ where: { id }, include: withLinks }),

  // Create a snippet and its host links in one nested write.
  create: ({ hostIds, ...data }: Prisma.SnippetUncheckedCreateInput & { hostIds?: string[] }) =>
    prisma.snippet.create({
      data: {
        ...data,
        ...(hostIds ? { hosts: { create: hostLinks(hostIds) } } : {})
      },
      include: withLinks
    }),

  // Update label/command and, when provided, reconcile the host links to exactly
  // the submitted set (deleteMany before create runs atomically). Omitting
  // hostIds leaves the links untouched.
  update: (id: string, { hostIds, ...data }: Prisma.SnippetUncheckedUpdateInput & { hostIds?: string[] }) =>
    prisma.snippet.update({
      where: { id },
      data: {
        ...data,
        ...(hostIds ? { hosts: { deleteMany: {}, create: hostLinks(hostIds) } } : {})
      },
      include: withLinks
    }),

  // Snippets applicable to a host: the global ones (no host links) plus those
  // linked to the host. An unknown hostId still returns the globals (never an
  // error). Ordered newest-first for a stable list.
  findForHost: (hostId: string) =>
    prisma.snippet.findMany({
      where: {
        OR: [
          { hosts: { none: {} } },
          { hosts: { some: { hostId } } }
        ]
      },
      include: withLinks,
      orderBy: { createdAt: 'desc' }
    })
}
