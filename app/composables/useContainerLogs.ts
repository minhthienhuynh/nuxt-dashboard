export function useContainerLogs() {
  const lines = ref<string[]>([])
  const connected = ref(false)
  const loading = ref(false)
  let eventSource: EventSource | null = null

  function connect(url: string) {
    if (import.meta.server) return

    disconnect()
    lines.value = []
    loading.value = true
    connected.value = false

    if (!url) return

    eventSource = new EventSource(url)

    eventSource.addEventListener('connected', () => {
      lines.value = []
      connected.value = true
      loading.value = false
    })

    eventSource.addEventListener('line', (e: MessageEvent) => {
      lines.value.push(e.data)
    })

    eventSource.onerror = () => {
      connected.value = false
      loading.value = false
    }
  }

  function disconnect() {
    if (import.meta.server) return

    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    connected.value = false
    loading.value = false
  }

  onUnmounted(() => disconnect())

  return { lines, connected, loading, connect, disconnect }
}
