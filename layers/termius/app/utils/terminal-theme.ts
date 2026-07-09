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

// Solarized Dark — a widely-recognised preset offered alongside the app's own
// light/dark palettes.
const solarizedDark: ITheme = {
  background: '#002b36',
  foreground: '#839496',
  cursor: '#93a1a1',
  cursorAccent: '#002b36',
  selectionBackground: '#073642',
  black: '#073642',
  red: '#dc322f',
  green: '#859900',
  yellow: '#b58900',
  blue: '#268bd2',
  magenta: '#d33682',
  cyan: '#2aa198',
  white: '#eee8d5',
  brightBlack: '#586e75',
  brightRed: '#cb4b16',
  brightGreen: '#586e75',
  brightYellow: '#657b83',
  brightBlue: '#839496',
  brightMagenta: '#6c71c4',
  brightCyan: '#93a1a1',
  brightWhite: '#fdf6e3'
}

// Dracula — the popular dark theme; colors from the official Dracula spec.
const dracula: ITheme = {
  background: '#282a36',
  foreground: '#f8f8f2',
  cursor: '#f8f8f2',
  cursorAccent: '#282a36',
  selectionBackground: '#44475a',
  black: '#21222c',
  red: '#ff5555',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  blue: '#bd93f9',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  white: '#f8f8f2',
  brightBlack: '#6272a4',
  brightRed: '#ff6e6e',
  brightGreen: '#69ff94',
  brightYellow: '#ffffa5',
  brightBlue: '#d6acff',
  brightMagenta: '#ff92df',
  brightCyan: '#a4ffff',
  brightWhite: '#ffffff'
}

// Named terminal color themes, chosen by id in the Appearance slideover. `light`
// and `dark` preserve the app's original palettes (still exercised by unit
// tests via `terminalTheme`).
export interface TerminalThemeOption {
  id: string
  label: string
  palette: ITheme
}

export const TERMINAL_THEMES: TerminalThemeOption[] = [
  { id: 'dark', label: 'Dark', palette: dark },
  { id: 'light', label: 'Light', palette: light },
  { id: 'solarized-dark', label: 'Solarized Dark', palette: solarizedDark },
  { id: 'dracula', label: 'Dracula', palette: dracula }
]

export const THEME_DEFAULT = 'dark'

// Resolve a theme id to its palette, falling back to the default theme when the
// id is unknown (e.g. a stale value from local storage).
export function resolveTheme(id: string): ITheme {
  const theme = TERMINAL_THEMES.find(t => t.id === id)
    ?? TERMINAL_THEMES.find(t => t.id === THEME_DEFAULT)
  return theme?.palette ?? dark
}

// Pick the xterm theme for the current app color mode. Retained for backward
// compatibility; the Appearance slideover selects themes by id via resolveTheme.
export function terminalTheme(mode: 'light' | 'dark'): ITheme {
  return mode === 'light' ? light : dark
}
