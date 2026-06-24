import { prisma } from '../prisma'
import { createRepository } from './base'

export const tagRepository = {
  ...createRepository(prisma.tag),
  // Tag names are unique, so upsert gives an idempotent find-or-create.
  findOrCreate: (name: string) =>
    prisma.tag.upsert({ where: { name }, update: {}, create: { name } })
}
