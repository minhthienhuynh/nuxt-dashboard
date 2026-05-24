import { createEventStream, getQuery } from 'h3'
import { Filter } from '@docker/node-sdk'
import { z } from 'zod'
import { getDocker } from '~~/server/utils/docker'
import { handleError } from '~~/server/utils/errors'

const eventsQuerySchema = z.object({
  type: z.string().optional()
})

export default eventHandler(async (event) => {
  try {
    const query = eventsQuerySchema.parse(getQuery(event))
    const typeFilter = query.type

    const docker = await getDocker()

    const filters = new Filter()
    if (typeFilter) {
      filters.set('type', typeFilter.split(','))
    }

    const stream = createEventStream(event)

    let closed = false
    stream.onClosed(() => closed = true)

    // Push connected event so client knows the stream is alive
    stream.push({ event: 'connected', data: '' })

    const dockerEvents = docker.systemEvents({ filters })

    // Process Docker events in background — stream.send() below
    // keeps the connection alive until stream.close() is called
    ;(async () => {
      try {
        for await (const msg of dockerEvents) {
          if (closed) break
          stream.push({
            event: msg.Type || 'message',
            id: msg.time ? String(msg.time) : undefined,
            data: JSON.stringify(msg)
          })
        }
      } catch (err) {
        console.error('[docker/events] Docker event stream ended:', err)
      } finally {
        stream.close()
      }
    })()

    return stream.send()
  } catch (error) {
    throw handleError(error)
  }
})
