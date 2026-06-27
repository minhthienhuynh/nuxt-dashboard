import { createError, eventHandler, getQuery, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { identityHandlers } from '~~/server/utils/api/handlers'
import { identityRepository } from '~~/server/utils/repositories/identity'
import { stripSecrets } from '~~/server/utils/api/serialize'
import { decryptSecret } from '~~/server/utils/vault'

// GET /api/identities/:id?reveal=true returns the decrypted password so the edit
// form can show existing material. Explicit opt-in (single-user app); every
// other request — including a plain GET — goes through the shared handler, which
// keeps secrets redacted.
export default eventHandler((event) => {
  if (event.method === 'GET' && getQuery(event).reveal === 'true') {
    return revealIdentity(event)
  }
  return identityHandlers.item(event)
})

async function revealIdentity(event: H3Event) {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Bad Request' })

  const row = await identityRepository.findById(id)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  return {
    ...stripSecrets(row),
    password: row.password ? decryptSecret(row.password) : null
  }
}
