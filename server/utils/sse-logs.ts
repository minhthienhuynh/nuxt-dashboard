import { createEventStream } from 'h3'
import type { H3Event } from 'h3'
import { DockerService } from '../services/docker.service'

export function streamContainerLogs(event: H3Event, containerName: string, tail = 100) {
  const stream = createEventStream(event)

  let closed = false
  const ac = new AbortController()

  stream.onClosed(() => {
    closed = true
    ac.abort()
  })

  stream.push({ event: 'connected', data: '' })

  ;(async () => {
    try {
      for await (const line of DockerService.getLogStream(containerName, tail, ac.signal)) {
        if (closed) break
        stream.push({ event: 'line', data: line })
      }
    } catch {
      // stream ended or aborted
    } finally {
      stream.close()
    }
  })()

  return stream.send()
}
