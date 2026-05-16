<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Website } from '~/types'

const props = defineProps<{
  website?: Website | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  created: []
}>()

const isEditing = computed(() => !!props.website)

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  domain: z.string().min(1, 'Domain is required'),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  documentRoot: z.string().min(1, 'Document root is required'),
  phpVersion: z.string().min(1, 'PHP version is required'),
  sslEnabled: z.boolean().default(false)
})

type Schema = z.output<typeof schema>

const phpVersions = ['8.4', '8.3', '8.2', '8.1', '8.0', '7.4', '7.3', '7.2', '7.1', '7.0', '5.6']

const state = reactive<Partial<Schema>>({
  name: props.website?.name ?? '',
  domain: props.website?.domain ?? '',
  port: props.website?.port ?? 80,
  documentRoot: props.website?.documentRoot ?? '',
  phpVersion: props.website?.phpVersion ?? '8.4',
  sslEnabled: props.website?.sslEnabled ?? false
})

const loading = ref(false)
const error = ref<string | null>(null)
const isBrowseOpen = ref(false)

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
      emit('created')
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
    state.port = props.website?.port ?? 80
    state.documentRoot = props.website?.documentRoot ?? ''
    state.phpVersion = props.website?.phpVersion ?? '8.4'
    state.sslEnabled = props.website?.sslEnabled ?? false
    error.value = null
  } else {
    error.value = null
  }
})
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
          <UInput v-model="state.name" placeholder="My Website" />
        </UFormField>

        <UFormField label="Domain" name="domain" required>
          <UInput v-model="state.domain" placeholder="myapp.test" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Port" name="port">
            <UInput v-model.number="state.port" type="number" placeholder="80" />
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
