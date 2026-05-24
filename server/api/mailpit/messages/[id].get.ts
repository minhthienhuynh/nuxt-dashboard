import { getRouterParam } from 'h3'
import { mailpitFetch } from '~~/server/utilities/mailpit'
import { handleError, AppError } from '~~/server/utils/errors'
import type { MailpitMessageDetail } from '~/types'

export default eventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id')
    if (!id) throw new AppError('Missing message ID', 400)

    const result = await mailpitFetch<MailpitMessageDetail>(`/message/${id}`)
    if (!result) {
      throw new AppError('Mailpit is not running', 503)
    }
    return result
  } catch (error) {
    throw handleError(error)
  }
})
