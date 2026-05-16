import { createEventStream, getQuery } from 'h3'
import { Filter } from '@docker/node-sdk'
import { getDocker } from '~~/server/utils/docker'

export default eventHandler(async (event) => {
  const query = getQuery(event)
  const typeFilter = query.type as string | undefined

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
    } catch {
      // Docker stream ended or errored
    } finally {
      stream.close()
    }
  })()

  return stream.send()
})
