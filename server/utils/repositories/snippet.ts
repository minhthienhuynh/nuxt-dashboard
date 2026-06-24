import { prisma } from '../prisma'
import { createRepository } from './base'

// hostId is optional: null means a global snippet, otherwise host-scoped.
export const snippetRepository = createRepository(prisma.snippet)
