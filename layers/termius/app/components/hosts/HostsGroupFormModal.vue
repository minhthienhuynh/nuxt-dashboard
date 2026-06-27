<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Group } from '../../types/ssh'

const props = defineProps<{
  group?: Group | null
  groups: Group[]
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isEdit = computed(() => !!props.group)

const schema = z.object({
  name: z.string().min(1, 'Required'),
  parentId: z.string().optional()
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({})

watch(open, (isOpen) => {
  if (!isOpen) return
  state.name = props.group?.name ?? ''
  state.parentId = props.group?.parentId ?? SELECT_NONE
})

// A group cannot be its own parent. (Deeper cycle prevention is left to the
// backend / future work — this just removes the obvious self-reference.)
const parentItems = computed(() => [
  { label: 'No parent (root)', value: SELECT_NONE },
  ...props.groups
    .filter(g => g.id !== props.group?.id)
    .map(g => ({ label: g.name, value: g.id }))
])

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const payload: Record<string, unknown> = { name: event.data.name }
  if (event.data.parentId && event.data.parentId !== SELECT_NONE) payload.parentId = event.data.parentId

  try {
    if (isEdit.value && props.group) {
      await $fetch(`/api/groups/${props.group.id}`, { method: 'PUT', body: payload })
    } else {
      await $fetch('/api/groups', { method: 'POST', body: payload })
    }
    toast.add({ title: isEdit.value ? 'Group updated' : 'Group created', color: 'success' })
    open.value = false
    emit('saved')
  } catch {
    toast.add({ title: 'Could not save group', color: 'error' })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? 'Edit group' : 'New group'"
    :description="isEdit ? 'Rename or re-parent this group.' : 'Create a group to organize hosts.'"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Name" name="name">
          <UInput v-model="state.name" placeholder="Production" class="w-full" />
        </UFormField>

        <UFormField label="Parent group" name="parentId">
          <USelect v-model="state.parentId" :items="parentItems" class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            :label="isEdit ? 'Save' : 'Create'"
            color="primary"
            type="submit"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
