import { getQuery } from 'h3'
import { mailpitFetch } from '~~/server/utilities/mailpit'
import { handleError } from '~~/server/utils/errors'
import type { MailpitMessagesResponse } from '~/types'

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const start = Number(query.start) || 0
    const limit = Number(query.limit) || 50

    const result = await mailpitFetch<MailpitMessagesResponse>(
      `/messages?start=${start}&limit=${limit}`
    )
    if (!result) {
      return { messages: [], total: 0, unread: 0, count: 0, start: 0 }
    }
    return result
  } catch (error) {
    throw handleError(error)
  }
})
