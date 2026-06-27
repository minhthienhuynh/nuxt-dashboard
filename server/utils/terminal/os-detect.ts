// Linux distro IDs we have a distinct icon for; any other Linux falls back to
// the generic 'linux'.
const KNOWN_DISTROS = new Set([
  'ubuntu', 'debian', 'fedora', 'centos', 'rhel', 'rocky', 'almalinux',
  'alpine', 'arch', 'linuxmint', 'raspbian', 'kali', 'gentoo'
])

function normalizeDistro(id: string): string {
  if (id.startsWith('opensuse')) return 'opensuse'
  if (id === 'redhat') return 'rhel'
  return KNOWN_DISTROS.has(id) ? id : 'linux'
}

// Detect the host OS from a probe that prints `/etc/os-release` (Linux) and/or
// falls back to `uname -s`. Returns the value to store: a distro id (e.g.
// 'ubuntu'), or 'linux' / 'macos' / 'windows' / 'other'. Returns null when the
// output is empty so the caller leaves the stored value untouched.
export function detectOs(probeOutput: string): string | null {
  const text = probeOutput.trim()
  if (!text) return null

  // os-release exposes a machine-readable `ID=ubuntu` (optionally quoted) line.
  const idMatch = text.match(/^ID=("?)([\w.-]+)\1\s*$/m)
  if (idMatch) return normalizeDistro(idMatch[2]!.toLowerCase())

  // Fallback: `uname -s` output (Darwin / Linux / CYGWIN_NT-… / …).
  const lower = text.toLowerCase()
  if (lower.includes('darwin')) return 'macos'
  if (lower.includes('cygwin') || lower.includes('mingw') || lower.includes('msys') || lower.includes('windows')) return 'windows'
  if (lower.includes('linux')) return 'linux'
  return 'other'
}
