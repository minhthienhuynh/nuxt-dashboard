// Tracks the SFTP browser tab opened per host so re-launching focuses the
// existing tab instead of reloading it. Mirrors terminal-windows.ts: a named
// `window.open` re-navigates (reloading) an existing tab, which would tear
// down the live control WebSocket — so we keep the Window handle and focus()
// instead.
const openWindows = new Map<string, Window>()

export function openSftpWindow(hostId: string) {
  const existing = openWindows.get(hostId)
  if (existing && !existing.closed) {
    existing.focus()
    return
  }
  const win = window.open(`/sftp/${hostId}`, `termius-sftp-${hostId}`)
  if (win) openWindows.set(hostId, win)
}
