import { getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { mailpitFetch } from '~~/server/utilities/mailpit'
import { handleError, AppError } from '~~/server/utils/errors'

const toggleReadSchema = z.object({
  read: z.boolean()
})

export default eventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) throw new AppError('Missing message ID', 400)

    const body = await readBody(event)
    const { read } = toggleReadSchema.parse(body)

    const result = await mailpitFetch('/messages', {
      method: 'PUT',
      body: JSON.stringify({ IDs: [id], Read: read })
    })
    if (result === null) {
      throw new AppError('Mailpit is not running', 503)
    }
    return { success: true, read }
  } catch (error) {
    throw handleError(error)
  }
})
