import { getRouterParam } from 'h3'
import { mailpitFetch } from '~~/server/utilities/mailpit'
import { handleError, AppError } from '~~/server/utils/errors'

export default eventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) throw new AppError('Missing message ID', 400)

    const result = await mailpitFetch('/messages', {
      method: 'DELETE',
      body: JSON.stringify({ IDs: [id] })
    })
    if (result === null) {
      throw new AppError('Mailpit is not running', 503)
    }
    return { success: true }
  } catch (error) {
    throw handleError(error)
  }
})
