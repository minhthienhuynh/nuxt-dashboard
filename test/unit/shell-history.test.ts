import { describe, expect, it } from 'vitest'
import { parseShellHistory } from '../../server/utils/terminal/shell-history'

// Build probe output. The first history line is always dropped as a
// possibly-truncated tail head, so prepend a throwaway line before the real
// entries under test.
function probe(shell: string, historyLines: string[]): string {
  return [`SHELL=${shell}`, '__truncated_head__', ...historyLines].join('\n') + '\n'
}

describe('parseShellHistory', () => {
  it('strips the zsh extended-history prefix', () => {
    const result = parseShellHistory(probe('zsh', [
      ': 1719900000:0;ls -la',
      ': 1719900100:0;git status'
    ]))
    expect(result).toEqual({ entries: ['git status', 'ls -la'] })
  })

  it('parses a plain bash history newest-first', () => {
    const result = parseShellHistory(probe('bash', ['echo one', 'echo two', 'echo three']))
    expect(result).toEqual({ entries: ['echo three', 'echo two', 'echo one'] })
  })

  it('treats sh like bash', () => {
    const result = parseShellHistory(probe('sh', ['pwd', 'whoami']))
    expect(result).toEqual({ entries: ['whoami', 'pwd'] })
  })

  it('joins trailing-backslash continuations into one entry', () => {
    const result = parseShellHistory(probe('bash', ['echo start \\', 'continued', 'final']))
    expect(result).toEqual({ entries: ['final', 'echo start \ncontinued'] })
  })

  it('de-duplicates keeping the most recent occurrence', () => {
    const result = parseShellHistory(probe('bash', ['git status', 'ls', 'git status']))
    expect(result).toEqual({ entries: ['git status', 'ls'] })
  })

  it('caps the result at 500 entries, newest first', () => {
    const lines = Array.from({ length: 600 }, (_, i) => `cmd-${i}`)
    const result = parseShellHistory(probe('bash', lines))
    if (!('entries' in result)) throw new Error('expected entries')
    expect(result.entries).toHaveLength(500)
    expect(result.entries[0]).toBe('cmd-599')
  })

  it('reports an unsupported shell', () => {
    expect(parseShellHistory(probe('fish', ['builtin history']))).toEqual({ error: 'unsupported-shell' })
  })

  it('reports not-found when the history file is empty', () => {
    // Only the SHELL marker, no history content at all.
    expect(parseShellHistory('SHELL=bash\n')).toEqual({ error: 'not-found' })
  })

  it('reports not-found when only the truncated head is present', () => {
    // The single content line is dropped as the truncated head, leaving nothing.
    expect(parseShellHistory('SHELL=bash\npartial-entry\n')).toEqual({ error: 'not-found' })
  })

  it('reports probe-failed when the SHELL marker is missing', () => {
    expect(parseShellHistory('')).toEqual({ error: 'probe-failed' })
    expect(parseShellHistory('some unexpected output\n')).toEqual({ error: 'probe-failed' })
  })
})
