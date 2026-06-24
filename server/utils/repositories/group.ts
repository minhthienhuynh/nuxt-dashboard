import { prisma } from '../prisma'
import { createRepository } from './base'

// Folder tree for hosts. Base CRUD is enough for now; nesting queries can be
// added here when the UI needs a tree view.
export const groupRepository = createRepository(prisma.group)
