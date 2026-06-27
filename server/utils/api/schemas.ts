import { z } from 'zod'

// Request validation schemas. strictObject rejects unknown keys. Secret fields
// (password, privateKey, passphrase) are accepted only where the vault encrypts
// them before persisting; they are never returned in responses (see serialize).

export const idParamSchema = z.strictObject({ id: z.string().min(1) })

const hostShape = {
  label: z.string().min(1),
  address: z.string().min(1),
  port: z.number().int().positive().optional(),
  os: z.string().optional(),
  description: z.string().optional(),
  groupId: z.string().optional(),
  identityId: z.string().optional()
}
export const hostCreateSchema = z.strictObject(hostShape)
export const hostUpdateSchema = z.strictObject(hostShape).partial()

const groupShape = {
  name: z.string().min(1),
  parentId: z.string().optional()
}
export const groupCreateSchema = z.strictObject(groupShape)
export const groupUpdateSchema = z.strictObject(groupShape).partial()

const identityShape = {
  label: z.string().optional(),
  username: z.string().min(1),
  authType: z.enum(['password', 'key']),
  sshKeyId: z.string().optional(),
  // Encrypted by the vault before persisting; never returned in responses.
  password: z.string().optional()
}
export const identityCreateSchema = z.strictObject(identityShape)
export const identityUpdateSchema = z.strictObject(identityShape).partial()

const sshKeyShape = {
  label: z.string().min(1),
  keyType: z.string().min(1),
  // Public key is optional — a key can be saved without it. The Prisma column is
  // NOT NULL with no default, so create falls back to '' when it is omitted.
  publicKey: z.string().optional(),
  // Encrypted by the vault before persisting; never returned in responses.
  privateKey: z.string().optional(),
  passphrase: z.string().optional()
}
export const sshKeyCreateSchema = z.strictObject({ ...sshKeyShape, publicKey: z.string().default('') })
export const sshKeyUpdateSchema = z.strictObject(sshKeyShape).partial()

const tagShape = {
  name: z.string().min(1)
}
export const tagCreateSchema = z.strictObject(tagShape)
export const tagUpdateSchema = z.strictObject(tagShape).partial()

const snippetShape = {
  label: z.string().min(1),
  command: z.string().min(1),
  hostId: z.string().optional()
}
export const snippetCreateSchema = z.strictObject(snippetShape)
export const snippetUpdateSchema = z.strictObject(snippetShape).partial()
