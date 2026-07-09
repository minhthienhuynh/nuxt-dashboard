// Terminal font size bounds (px). Default mirrors the original hard-coded size.
export const FONT_SIZE_DEFAULT = 13
export const FONT_SIZE_MIN = 8
export const FONT_SIZE_MAX = 32

// Keep a font size within the allowed range.
export function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(size)))
}

// Curated monospace fonts offered in the terminal Appearance slideover. The
// non-system fonts are self-hosted via `@fontsource/*` (imported by
// TerminalView.client.vue) so they render on any OS. Each `stack` is a CSS
// font-family value passed straight to xterm and ends in `monospace` as a
// final fallback.
export interface TerminalFont {
  id: string
  label: string
  stack: string
}

export const TERMINAL_FONTS: TerminalFont[] = [
  { id: 'system', label: 'System monospace', stack: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', stack: '"JetBrains Mono", ui-monospace, monospace' },
  { id: 'fira-code', label: 'Fira Code', stack: '"Fira Code", ui-monospace, monospace' },
  { id: 'source-code-pro', label: 'Source Code Pro', stack: '"Source Code Pro", ui-monospace, monospace' },
  { id: 'ibm-plex-mono', label: 'IBM Plex Mono', stack: '"IBM Plex Mono", ui-monospace, monospace' }
]

export const FONT_FAMILY_DEFAULT = 'system'

// Resolve a font id to its CSS font stack, falling back to the default font
// when the id is unknown (e.g. a stale value from local storage).
export function resolveFontStack(id: string): string {
  const font = TERMINAL_FONTS.find(f => f.id === id)
    ?? TERMINAL_FONTS.find(f => f.id === FONT_FAMILY_DEFAULT)
  return font?.stack ?? 'monospace'
}

// Format the SSH target shown in the terminal toolbar. Falls back to `host:port`
// when no username is known (credentials live on Identity, which may be absent).
export function formatSshTarget(target: { username?: string | null, address: string, port: number }): string {
  const hostPort = `${target.address}:${target.port}`
  const user = target.username?.trim()
  return user ? `${user}@${hostPort}` : hostPort
}
