import { createError, eventHandler, getQuery, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { sshKeyHandlers } from '~~/server/utils/api/handlers'
import { sshKeyRepository } from '~~/server/utils/repositories/sshKey'
import { stripSecrets } from '~~/server/utils/api/serialize'
import { decryptSecret } from '~~/server/utils/vault'

// GET /api/ssh-keys/:id?reveal=true returns the decrypted privateKey/passphrase
// so the edit form can show existing key material. This is an explicit opt-in
// (single-user app); every other request — including a plain GET — goes through
// the shared handler, which keeps secrets redacted.
export default eventHandler((event) => {
  if (event.method === 'GET' && getQuery(event).reveal === 'true') {
    return revealSshKey(event)
  }
  return sshKeyHandlers.item(event)
})

async function revealSshKey(event: H3Event) {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request' })

  const row = await sshKeyRepository.findById(id)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  return {
    ...stripSecrets(row),
    privateKey: row.privateKey ? decryptSecret(row.privateKey) : null,
    passphrase: row.passphrase ? decryptSecret(row.passphrase) : null
  }
}
