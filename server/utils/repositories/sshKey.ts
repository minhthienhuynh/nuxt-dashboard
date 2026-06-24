import { prisma } from '../prisma'
import { createRepository } from './base'

// Secret fields (privateKey, passphrase) are stored verbatim as ciphertext;
// encryption/decryption is a service-layer concern, not the repository's.
export const sshKeyRepository = createRepository(prisma.sSHKey)
