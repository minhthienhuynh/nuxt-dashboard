import { getQuery } from 'h3'
import { groupRepository } from '../repositories/group'
import { hostRepository } from '../repositories/host'
import { identityRepository } from '../repositories/identity'
import { snippetRepository } from '../repositories/snippet'
import { sshKeyRepository } from '../repositories/sshKey'
import { tagRepository } from '../repositories/tag'
import { createCrudHandlers } from './crud'
import {
  groupCreateSchema,
  groupUpdateSchema,
  hostCreateSchema,
  hostUpdateSchema,
  identityCreateSchema,
  identityUpdateSchema,
  snippetCreateSchema,
  snippetUpdateSchema,
  sshKeyCreateSchema,
  sshKeyUpdateSchema,
  tagCreateSchema,
  tagUpdateSchema
} from './schemas'
import { serializeHost, serializeIdentity, serializeSshKey } from './serialize'
import { encryptSecret } from '../vault'

export const groupHandlers = createCrudHandlers({
  repo: groupRepository,
  createSchema: groupCreateSchema,
  updateSchema: groupUpdateSchema
})

export const tagHandlers = createCrudHandlers({
  repo: tagRepository,
  createSchema: tagCreateSchema,
  updateSchema: tagUpdateSchema
})

export const snippetHandlers = createCrudHandlers({
  repo: snippetRepository,
  createSchema: snippetCreateSchema,
  updateSchema: snippetUpdateSchema
})

export const identityHandlers = createCrudHandlers({
  repo: identityRepository,
  createSchema: identityCreateSchema,
  updateSchema: identityUpdateSchema,
  serialize: serializeIdentity,
  // Encrypt a non-empty password; DROP an empty/absent one so it can't
  // overwrite the stored secret (with either '' or an encrypted '').
  transformInput: (data) => {
    const { password, ...rest } = data
    return password ? { ...rest, password: encryptSecret(password) } : rest
  }
})

export const sshKeyHandlers = createCrudHandlers({
  repo: sshKeyRepository,
  createSchema: sshKeyCreateSchema,
  updateSchema: sshKeyUpdateSchema,
  serialize: serializeSshKey,
  transformInput: (data) => {
    const copy = { ...data }
    // Encrypt non-empty secrets; drop empty/absent ones so '' cannot clobber a
    // stored value.
    if (copy.privateKey) copy.privateKey = encryptSecret(copy.privateKey)
    else delete copy.privateKey
    if (copy.passphrase) copy.passphrase = encryptSecret(copy.passphrase)
    else delete copy.passphrase
    return copy
  }
})

export const hostHandlers = createCrudHandlers({
  repo: hostRepository,
  createSchema: hostCreateSchema,
  updateSchema: hostUpdateSchema,
  serialize: serializeHost,
  listQuery: (event) => {
    const tag = getQuery(event).tag
    return typeof tag === 'string' ? hostRepository.findByTag(tag) : undefined
  },
  findOne: (id, event) =>
    getQuery(event).relations === 'true' ? hostRepository.withRelations(id) : hostRepository.findById(id)
})
