<script setup lang="ts">
import { FONT_SIZE_MAX, FONT_SIZE_MIN, TERMINAL_FONTS } from '../../utils/terminal'
import { TERMINAL_THEMES } from '../../utils/terminal-theme'

const open = defineModel<boolean>('open', { default: false })

const { fontFamily, fontSize, theme, setFontSize, zoomIn, zoomOut } = useTerminalAppearance()

const fontItems = TERMINAL_FONTS.map(f => ({ label: f.label, value: f.id }))
const themeItems = TERMINAL_THEMES.map(t => ({ label: t.label, value: t.id }))

// USlider emits number | undefined; keep the model a plain clamped number.
function onSize(value: number | undefined) {
  if (typeof value === 'number') setFontSize(value)
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Appearance"
    description="Customize the terminal font, text size, and color theme"
  >
    <template #body>
      <div class="flex flex-col gap-6">
        <UFormField label="Font family" name="fontFamily">
          <USelect
            v-model="fontFamily"
            :items="fontItems"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Text size" name="fontSize" help="Also adjustable with ⌘+, ⌘−, and ⌘0 in the terminal">
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-minus"
              color="neutral"
              variant="subtle"
              size="xs"
              :disabled="fontSize <= FONT_SIZE_MIN"
              aria-label="Decrease text size"
              @click="zoomOut"
            />
            <USlider
              :model-value="fontSize"
              :min="FONT_SIZE_MIN"
              :max="FONT_SIZE_MAX"
              :step="1"
              class="flex-1"
              @update:model-value="onSize"
            />
            <UButton
              icon="i-lucide-plus"
              color="neutral"
              variant="subtle"
              size="xs"
              :disabled="fontSize >= FONT_SIZE_MAX"
              aria-label="Increase text size"
              @click="zoomIn"
            />
            <span class="w-10 text-right font-mono text-sm text-toned tabular-nums">{{ fontSize }}px</span>
          </div>
        </UFormField>

        <UFormField label="Theme" name="theme">
          <USelect
            v-model="theme"
            :items="themeItems"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
  </USlideover>
</template>
