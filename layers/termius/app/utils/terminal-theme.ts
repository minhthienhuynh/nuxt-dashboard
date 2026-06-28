import type { ITheme } from '@xterm/xterm'

// xterm color palettes for the two app color modes. Backgrounds track the app's
// zinc neutral so the terminal blends with the surrounding `bg-default` shell.
const dark: ITheme = {
  background: '#18181b',
  foreground: '#e4e4e7',
  cursor: '#e4e4e7',
  cursorAccent: '#18181b',
  selectionBackground: '#3f3f46',
  black: '#27272a',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa'
}

const light: ITheme = {
  background: '#ffffff',
  foreground: '#18181b',
  cursor: '#18181b',
  cursorAccent: '#ffffff',
  selectionBackground: '#d4d4d8',
  black: '#27272a',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#ca8a04',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#52525b',
  brightBlack: '#71717a',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#18181b'
}

// Pick the xterm theme for the current app color mode.
export function terminalTheme(mode: 'light' | 'dark'): ITheme {
  return mode === 'light' ? light : dark
}
