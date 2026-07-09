import type { HistoryError } from '#shared/terminal-protocol'

// Fixed, read-only probe run over a side-channel exec on the live SSH client.
// It prints the login shell name on the first line, then the tail of the
// matching history file. `tail -c` bounds the transfer regardless of file size.
// No user input is ever interpolated — the string is a constant.
export const SHELL_HISTORY_PROBE
  = 's=$(basename "${SHELL:-}"); '
    + 'printf \'SHELL=%s\\n\' "$s"; '
    + 'case "$s" in '
    + 'zsh) tail -c 65536 "${HISTFILE:-$HOME/.zsh_history}" 2>/dev/null;; '
    + 'bash|sh) tail -c 65536 "${HISTFILE:-$HOME/.bash_history}" 2>/dev/null;; '
    + 'esac'

// Cap the number of entries returned to the client so a huge history stays cheap
// to transfer and render.
const MAX_ENTRIES = 500

// Shells we can read a plain history file for. `sh` maps to the bash file.
const SUPPORTED_SHELLS = new Set(['bash', 'zsh', 'sh'])

// zsh extended-history line prefix: ": <started>:<elapsed>;<command>".
const ZSH_EXTENDED_PREFIX = /^: \d+:\d+;/

export type ShellHistoryResult = { entries: string[] } | { error: HistoryError }

// Parse the probe output into command entries (most-recent-first, de-duplicated,
// capped) or a failure reason. Pure and side-effect free so it is unit-testable.
export function parseShellHistory(probeOutput: string): ShellHistoryResult {
  const lines = probeOutput.split('\n')
  const marker = (lines[0] ?? '').match(/^SHELL=(.*)$/)
  // No SHELL marker means the probe itself did not run as expected.
  if (!marker) return { error: 'probe-failed' }

  const shell = marker[1]!.trim()
  if (!SUPPORTED_SHELLS.has(shell)) return { error: 'unsupported-shell' }

  // Everything after the marker is the history-file tail. Its first line may be a
  // partial entry because `tail -c` can start mid-line, so drop it (lines[1]).
  const body = lines.slice(2)

  // Join bash-style trailing-backslash continuations into a single entry.
  const joined: string[] = []
  let pending: string | null = null
  for (const raw of body) {
    const line = raw.replace(/\r$/, '')
    const continues = line.endsWith('\\')
    const piece = continues ? line.slice(0, -1) : line
    pending = pending === null ? piece : `${pending}\n${piece}`
    if (!continues) {
      joined.push(pending)
      pending = null
    }
  }
  if (pending !== null) joined.push(pending)

  // Strip the zsh extended prefix and drop blank lines.
  const commands = joined
    .map(entry => entry.replace(ZSH_EXTENDED_PREFIX, '').trim())
    .filter(entry => entry.length > 0)

  if (commands.length === 0) return { error: 'not-found' }

  // Walk newest-to-oldest, keeping the first (most recent) occurrence of each
  // command, until the cap is reached.
  const seen = new Set<string>()
  const entries: string[] = []
  for (let i = commands.length - 1; i >= 0; i--) {
    const command = commands[i]!
    if (seen.has(command)) continue
    seen.add(command)
    entries.push(command)
    if (entries.length >= MAX_ENTRIES) break
  }

  return { entries }
}
