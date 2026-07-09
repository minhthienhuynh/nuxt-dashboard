<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Identity, SSHKey } from '../../types/ssh'

const props = defineProps<{
  identity?: Identity | null
  sshKeys: SSHKey[]
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isEdit = computed(() => !!props.identity)

const schema = z.object({
  label: z.string().optional(),
  username: z.string().min(1, 'Required'),
  authType: z.enum(['password', 'key']),
  password: z.string().optional(),
  sshKeyId: z.string().optional()
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({})
const showPassword = ref(false)
const { reveal } = useRevealSecret()

// On edit, the stored password is loaded via ?reveal=true so the form shows
// existing material; it is re-encrypted on save (or kept if left blank).
watch(open, async (isOpen) => {
  if (!isOpen) return
  const editingId = props.identity?.id
  state.label = props.identity?.label ?? ''
  state.username = props.identity?.username ?? ''
  state.authType = props.identity?.authType ?? 'password'
  state.password = ''
  state.sshKeyId = props.identity?.sshKeyId ?? SELECT_NONE
  showPassword.value = false

  // Only password identities have a password to reveal.
  if (editingId && props.identity?.authType === 'password') {
    const revealed = await reveal<{ password: string | null }>(
      'identities', editingId, () => open.value && props.identity?.id === editingId)
    if (revealed) state.password = revealed.password ?? ''
  }
})

const keyItems = computed(() =>
  props.sshKeys.length
    ? props.sshKeys.map(k => ({ label: k.label, value: k.id }))
    : [{ label: 'No saved keys yet', value: SELECT_NONE }])

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const d = event.data

  if (d.authType === 'key' && (!d.sshKeyId || d.sshKeyId === SELECT_NONE)) {
    toast.add({ title: 'Select an SSH key — import one first', color: 'error' })
    return
  }

  // strictObject on the server rejects empty optional strings, so only include
  // fields that carry a real value.
  const payload: Record<string, unknown> = {
    username: d.username,
    authType: d.authType
  }
  if (d.label) payload.label = d.label
  if (d.authType === 'password' && d.password) payload.password = d.password
  if (d.authType === 'key' && d.sshKeyId && d.sshKeyId !== SELECT_NONE) payload.sshKeyId = d.sshKeyId

  try {
    if (isEdit.value && props.identity) {
      await $fetch(`/api/identities/${props.identity.id}`, { method: 'PUT', body: payload })
    } else {
      await $fetch('/api/identities', { method: 'POST', body: payload })
    }
    toast.add({ title: isEdit.value ? 'Identity updated' : 'Identity created', color: 'success' })
    open.value = false
    emit('saved')
  } catch {
    toast.add({ title: 'Could not save identity', color: 'error' })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? 'Edit identity' : 'New identity'"
    :description="isEdit ? 'Update this identity.' : 'Add a reusable credential.'"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Username" name="username">
          <UInput v-model="state.username" placeholder="root" class="w-full" />
        </UFormField>

        <UFormField label="Authentication" name="authType">
          <USelect v-model="state.authType" :items="AUTH_TYPE_ITEMS" class="w-full" />
        </UFormField>

        <UFormField
          v-if="state.authType === 'password'"
          label="Password"
          name="password"
        >
          <UInput
            v-model="state.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Enter password"
            class="w-full"
          >
            <template #trailing>
              <UButton
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                color="neutral"
                variant="link"
                size="sm"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>

        <UFormField
          v-else-if="state.authType === 'key'"
          label="SSH key"
          name="sshKeyId"
        >
          <USelect v-model="state.sshKeyId" :items="keyItems" class="w-full" />
        </UFormField>

        <UFormField label="Label" name="label">
          <UInput v-model="state.label" placeholder="Optional — defaults to the username" class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
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
