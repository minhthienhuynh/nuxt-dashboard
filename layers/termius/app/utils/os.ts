// Per-OS display metadata. The `os` value is detected on connect (see
// server/utils/terminal/os-detect.ts) and may be a Linux distro id, or one of
// linux/macos/windows/other. Icons are simple-icons brand logos where available
// (lucide for the generic fallback). Colors are brand colors applied inline — an
// arbitrary `text-[#hex]` class would be purged by Tailwind's JIT. OSes without a
// distinct color (macOS/Apple is monochrome, "other") render in the muted theme
// color instead.
export interface OsMeta {
  icon: string
  color?: string
}

export const OS_META: Record<string, OsMeta> = {
  ubuntu: { icon: 'i-simple-icons-ubuntu', color: '#E95420' },
  debian: { icon: 'i-simple-icons-debian', color: '#A81D33' },
  fedora: { icon: 'i-simple-icons-fedora', color: '#51A2DA' },
  centos: { icon: 'i-simple-icons-centos', color: '#932279' },
  rhel: { icon: 'i-simple-icons-redhat', color: '#EE0000' },
  rocky: { icon: 'i-simple-icons-rockylinux', color: '#10B981' },
  almalinux: { icon: 'i-simple-icons-almalinux', color: '#0D597F' },
  alpine: { icon: 'i-simple-icons-alpinelinux', color: '#0D7EC0' },
  arch: { icon: 'i-simple-icons-archlinux', color: '#1793D1' },
  linuxmint: { icon: 'i-simple-icons-linuxmint', color: '#87CF3E' },
  raspbian: { icon: 'i-simple-icons-raspberrypi', color: '#C51A4A' },
  kali: { icon: 'i-simple-icons-kalilinux', color: '#557C94' },
  gentoo: { icon: 'i-simple-icons-gentoo', color: '#54487A' },
  opensuse: { icon: 'i-simple-icons-opensuse', color: '#73BA25' },
  linux: { icon: 'i-simple-icons-linux', color: '#FCC624' },
  macos: { icon: 'i-simple-icons-apple' },
  windows: { icon: 'i-simple-icons-windows', color: '#0078D4' },
  other: { icon: 'i-lucide-monitor' }
}

const FALLBACK: OsMeta = { icon: 'i-lucide-monitor' }

// Resolve display metadata for a (possibly null/unknown) os value.
export function osMeta(os: string | null | undefined): OsMeta {
  return (os && OS_META[os]) || FALLBACK
}
