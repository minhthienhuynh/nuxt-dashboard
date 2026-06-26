// Tracks the terminal browser tab opened per host so re-connecting focuses the
// existing tab instead of reloading it. Module-scoped, so it survives across
// host-page mounts within the SPA session. `window.open(url, name)` would
// re-navigate (reload) a named tab — which would tear down the live xterm +
// WebSocket session — so we keep the Window handle and call focus() instead.
const openWindows = new Map<string, Window>()

export function openTerminalWindow(hostId: string) {
  const existing = openWindows.get(hostId)
  if (existing && !existing.closed) {
    existing.focus()
    return
  }
  const win = window.open(`/terminal/${hostId}`, `termius-terminal-${hostId}`)
  if (win) openWindows.set(hostId, win)
}
