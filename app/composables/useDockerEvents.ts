import type { EventMessage } from '@docker/node-sdk'
import { createSharedComposable } from '@vueuse/core'

const CONTAINER_STATE_MAP: Record<string, string> = {
  start: 'running',
  restart: 'running',
  unpause: 'running',
  stop: 'stopped',
  kill: 'stopped',
  die: 'stopped',
  pause: 'paused',
  destroy: 'removed'
}

const EVENT_TYPES = ['container', 'image', 'volume', 'network', 'daemon'] as const
const MAX_EVENTS = 200

const _useDockerEvents = () => {
  const connected = ref(false)
  const lastEvent = ref<EventMessage | null>(null)
  const events = ref<EventMessage[]>([])
  const containerStates = ref<Record<string, string>>({})

  let es: EventSource | null = null

  function trackEvent(msg: EventMessage) {
    lastEvent.value = msg
    events.value = [msg, ...events.value].slice(0, MAX_EVENTS)
  }

  function trackContainerState(msg: EventMessage) {
    const name = msg.Actor?.Attributes?.name
    const mapped = CONTAINER_STATE_MAP[msg.Action || '']
    if (name && mapped) {
      containerStates.value = { ...containerStates.value, [name]: mapped }
    }
  }

  function connect(type?: string) {
    if (es) return

    const url = type
      ? `/api/docker/events?type=${type}`
      : '/api/docker/events'

    es = new EventSource(url)

    es.addEventListener('connected', () => {
      connected.value = true
    })

    for (const eventType of EVENT_TYPES) {
      es.addEventListener(eventType, (e: MessageEvent) => {
        const msg = JSON.parse(e.data) as EventMessage
        trackEvent(msg)
        if (eventType === 'container') {
          trackContainerState(msg)
        }
      })
    }

    // Fallback for unregistered event types
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as EventMessage
        trackEvent(msg)
      } catch { /* ignore unparseable messages */ }
    }

    // Let EventSource auto-reconnect — only mark disconnected
    es.onerror = () => {
      connected.value = false
    }
  }

  function disconnect() {
    if (es) {
      es.close()
      es = null
    }
    connected.value = false
  }

  return {
    connected,
    lastEvent,
    events,
    containerStates,
    connect,
    disconnect
  }
}

export const useDockerEvents = createSharedComposable(_useDockerEvents)
