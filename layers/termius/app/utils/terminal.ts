// Terminal font size bounds (px). Default mirrors the original hard-coded size.
export const FONT_SIZE_DEFAULT = 13
export const FONT_SIZE_MIN = 8
export const FONT_SIZE_MAX = 32

// Keep a font size within the allowed range.
export function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(size)))
}

// Format the SSH target shown in the terminal toolbar. Falls back to `host:port`
// when no username is known (credentials live on Identity, which may be absent).
export function formatSshTarget(target: { username?: string | null, address: string, port: number }): string {
  const hostPort = `${target.address}:${target.port}`
  const user = target.username?.trim()
  return user ? `${user}@${hostPort}` : hostPort
}
