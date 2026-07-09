import { createSharedComposable, useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'
import { FONT_FAMILY_DEFAULT, FONT_SIZE_DEFAULT, clampFontSize, resolveFontStack } from '../utils/terminal'
import { THEME_DEFAULT, resolveTheme } from '../utils/terminal-theme'

// Shared, persisted terminal appearance preferences (font family, text size,
// color theme). Backed by local storage so choices survive reloads and are the
// starting state for every terminal window on this browser. Shared via
// createSharedComposable so the Appearance slideover and the terminal view read
// and write the same refs — this keeps the size slider and the keyboard zoom
// shortcuts in sync automatically.
const _useTerminalAppearance = () => {
  // Seed the default theme from the current app color mode so users who never
  // open the panel keep the original light/dark behavior. Once a value is
  // stored, the theme is independent of the app color mode.
  const colorMode = useColorMode()
  const themeDefault = colorMode.value === 'light' ? 'light' : THEME_DEFAULT

  const fontFamily = useLocalStorage('terminal:fontFamily', FONT_FAMILY_DEFAULT)
  // Reuse the existing key so current users keep their zoom size.
  const fontSize = useLocalStorage('terminal:fontSize', FONT_SIZE_DEFAULT)
  const theme = useLocalStorage('terminal:theme', themeDefault)

  const fontFamilyStack = computed(() => resolveFontStack(fontFamily.value))
  const resolvedTheme = computed(() => resolveTheme(theme.value))

  function setFontSize(size: number) {
    fontSize.value = clampFontSize(size)
  }
  function zoomIn() {
    setFontSize(fontSize.value + 1)
  }
  function zoomOut() {
    setFontSize(fontSize.value - 1)
  }
  function zoomReset() {
    fontSize.value = FONT_SIZE_DEFAULT
  }

  return {
    fontFamily,
    fontSize,
    theme,
    fontFamilyStack,
    resolvedTheme,
    setFontSize,
    zoomIn,
    zoomOut,
    zoomReset
  }
}

export const useTerminalAppearance = createSharedComposable(_useTerminalAppearance)
