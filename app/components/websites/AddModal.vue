<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Website, PhpExtensionInfo } from '~/types'

import { dash } from 'radash'
import { WEBSITE_TYPE_OPTIONS } from '~/constants/website-types'

const props = defineProps<{
  website?: Website | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  created: [id: number]
}>()

const isEditing = computed(() => !!props.website)

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  domain: z.string().min(1, 'Domain is required'),
  type: z.enum(['php-fpm', 'php-serve', 'php-octane']).default('php-fpm'),
  port: z.coerce.number().int().min(0).max(65535).default(0),
  documentRoot: z.string().min(1, 'Document root is required'),
  phpVersion: z.string().min(1, 'PHP version is required'),
  sslEnabled: z.boolean().default(false)
})

type Schema = z.output<typeof schema>

const phpVersions = ['8.4', '8.3', '8.2', '8.1', '8.0', '7.4', '7.3', '7.2', '7.1', '7.0', '5.6']

const state = reactive<Partial<Schema>>({
  name: props.website?.name ?? '',
  domain: props.website?.domain ?? '',
  type: props.website?.type ?? 'php-fpm',
  port: props.website?.port ?? 0,
  documentRoot: props.website?.documentRoot ?? '',
  phpVersion: props.website?.phpVersion ?? '8.4',
  sslEnabled: props.website?.sslEnabled ?? false
})

const loading = ref(false)
const error = ref<string | null>(null)
const isBrowseOpen = ref(false)

// ── Extensions ────────────────────────────────────────────────

const { data: allExtensions, refresh: refreshExtensions } = useFetch<PhpExtensionInfo[]>('/api/php-extensions', {
  lazy: true,
  default: () => [],
  query: computed(() => ({ php: state.phpVersion ?? '' }))
})

const enabledIds = ref<Set<number>>(new Set())
const searchExt = ref('')

const selectedExtensions = computed(() =>
  (allExtensions.value ?? []).filter(e => enabledIds.value.has(e.id))
)

const filteredExtensions = computed(() => {
  if (!searchExt.value) return allExtensions.value ?? []
  const q = searchExt.value.toLowerCase()
  return (allExtensions.value ?? []).filter(ext =>
    ext.name.toLowerCase().includes(q)
  )
})

function toggleExtension(id: number) {
  const next = new Set(enabledIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  enabledIds.value = next
}

function selectAll() {
  enabledIds.value = new Set((allExtensions.value ?? []).map(e => e.id))
}

function deselectAll() {
  enabledIds.value = new Set()
}

watch(() => state.phpVersion, () => {
  if (open.value) refreshExtensions()
})

watch(() => state.type, (type) => {
  state.port = type === 'php-fpm' ? 9000 : 0
})

// ── Submit ────────────────────────────────────────────────────

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  error.value = null

  try {
    const body = event.data
    const url = isEditing.value
      ? `/api/websites/${props.website!.id}`
      : '/api/websites'

    const method = isEditing.value ? 'PUT' : 'POST'

    const res = await $fetch<Website>(url, { method, body })

    if (res) {
      // Sync extensions for both create and edit
      if (isEditing.value || enabledIds.value.size > 0) {
        await $fetch(`/api/websites/${res.id}/extensions`, {
          method: 'PUT',
          body: { extensionIds: [...enabledIds.value] }
        })
      }
      open.value = false
      emit('created', res.id)
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? e?.message ?? 'Failed to save website'
  } finally {
    loading.value = false
  }
}

watch(open, () => {
  if (open.value) {
    state.name = props.website?.name ?? ''
    state.domain = props.website?.domain ?? ''
    state.type = props.website?.type ?? 'php-fpm'
    state.port = props.website?.port ?? 0
    state.documentRoot = props.website?.documentRoot ?? ''
    state.phpVersion = props.website?.phpVersion ?? '8.4'
    state.sslEnabled = props.website?.sslEnabled ?? false
    error.value = null
    searchExt.value = ''
    // Populate extensions when editing
    if (props.website?.extensions) {
      enabledIds.value = new Set(
        props.website.extensions
          .filter(e => e.enabled)
          .map(e => e.extensionId)
      )
    } else {
      enabledIds.value = new Set()
    }
  } else {
    error.value = null
  }
})

function onNameInput(value: string) {
  state.name = value
  state.domain = value ? dash(value) + '.local' : ''
}
</script>

<template>
  <UModal v-model:open="open" :title="isEditing ? 'Edit Website' : 'Add Website'">
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Name" name="name" required>
          <UInput
            :model-value="state.name"
            placeholder="My Website"
            @update:model-value="onNameInput"
          />
        </UFormField>

        <UFormField label="Domain" name="domain" required>
          <UInput v-model="state.domain" placeholder="myapp.test" />
        </UFormField>

        <div class="grid grid-cols-3 gap-4">
          <UFormField label="Type" name="type" required>
            <USelect
              v-model="state.type"
              :items="WEBSITE_TYPE_OPTIONS"
              placeholder="Select type"
            />
          </UFormField>

          <UFormField v-if="state.type !== 'php-fpm'" label="Port" name="port">
            <UInput v-model.number="state.port" type="number" placeholder="0" />
          </UFormField>

          <UFormField label="PHP Version" name="phpVersion" required>
            <USelect
              v-model="state.phpVersion"
              :items="phpVersions.map(v => ({ label: `PHP ${v}`, value: v }))"
              placeholder="Select version"
            />
          </UFormField>
        </div>

        <UFormField label="Document Root" name="documentRoot" required>
          <div class="flex gap-2">
            <UInput v-model="state.documentRoot" placeholder="/var/www/myapp" class="flex-1" />
            <UButton icon="i-lucide-folder-open" variant="outline" @click="isBrowseOpen = true" />
          </div>
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="SSL" name="sslEnabled" class="flex items-end pb-2">
            <USwitch v-model="state.sslEnabled" />
          </UFormField>
        </div>

        <!-- ── PHP Extensions ──────────────────────────────── -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">PHP Extensions</span>
            <span class="text-xs text-(--ui-text-dimmed)">
              {{ enabledIds.size }} selected
            </span>
          </div>

          <!-- Selected tags -->
          <div
            v-if="selectedExtensions.length"
            class="flex flex-wrap gap-1"
          >
            <span
              v-for="ext in selectedExtensions"
              :key="ext.id"
              class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-(--ui-bg-elevated) border border-default"
            >
              {{ ext.name }}
              <button
                type="button"
                class="inline-flex items-center justify-center size-3.5 rounded hover:bg-(--ui-bg-accented) text-(--ui-text-dimmed)"
                @click.stop="toggleExtension(ext.id)"
              >
                <span class="i-lucide-x size-2.5" />
              </button>
            </span>
          </div>

          <UInput
            v-model="searchExt"
            icon="i-lucide-search"
            placeholder="Search extensions..."
            size="xs"
          />

          <div class="flex gap-1.5">
            <UButton
              size="xs"
              variant="outline"
              label="All"
              @click="selectAll"
            />
            <UButton
              size="xs"
              variant="outline"
              label="None"
              @click="deselectAll"
            />
          </div>

          <div class="max-h-52 overflow-y-auto border border-default rounded-md">
            <div
              v-for="ext in filteredExtensions"
              :key="ext.id"
              class="flex items-center gap-2.5 py-1.5 px-2.5 hover:bg-(--ui-bg-elevated) cursor-pointer border-b border-default/50 last:border-b-0"
              @click="toggleExtension(ext.id)"
            >
              <UCheckbox :model-value="enabledIds.has(ext.id)" />
              <span class="text-sm flex-1">{{ ext.name }}</span>
              <UBadge :label="ext.type" variant="soft" size="xs" />
            </div>
            <div
              v-if="filteredExtensions.length === 0"
              class="py-4 text-sm text-(--ui-text-dimmed) text-center"
            >
              No extensions found
            </div>
          </div>
        </div>

        <div v-if="error" class="text-(--ui-error) text-sm">
          {{ error }}
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <UButton variant="outline" label="Cancel" @click="open = false" />
          <UButton
            type="submit"
            :label="isEditing ? 'Save Changes' : 'Create Website'"
            :loading="loading"
            color="primary"
          />
        </div>
      </UForm>
    </template>
  </UModal>

  <WebsitesBrowsePathModal
    v-model="state.documentRoot"
    v-model:open="isBrowseOpen"
  />
</template>
