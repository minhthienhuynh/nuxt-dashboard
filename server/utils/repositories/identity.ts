import { prisma } from '../prisma'
import { createRepository } from './base'

// The password field is stored verbatim as ciphertext; the repository never
// encrypts, decrypts, or redacts it.
export const identityRepository = createRepository(prisma.identity)
