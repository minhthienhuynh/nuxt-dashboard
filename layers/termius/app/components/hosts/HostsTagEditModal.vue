<script setup lang="ts">
import { reactive, watch } from 'vue'
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Tag } from '../../types/ssh'

const props = defineProps<{
  tag: Tag | null
}>()

const emit = defineEmits<{
  // The new name, so the page can update an active filter referencing the old one.
  saved: [name: string]
}>()

const open = defineModel<boolean>('open', { default: false })

const schema = z.object({ name: z.string().min(1, 'Required') })
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({})

watch(open, (isOpen) => {
  if (!isOpen) return
  state.name = props.tag?.name ?? ''
})

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!props.tag) return
  try {
    await $fetch(`/api/tags/${props.tag.id}`, { method: 'PUT', body: { name: event.data.name } })
    toast.add({ title: 'Tag renamed', color: 'success' })
    open.value = false
    emit('saved', event.data.name)
  } catch {
    toast.add({ title: 'Could not rename tag', color: 'error' })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Rename tag"
    description="Update this tag's name."
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Name" name="name">
          <UInput
            v-model="state.name"
            placeholder="production"
            autofocus
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            label="Save"
            color="primary"
            type="submit"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
