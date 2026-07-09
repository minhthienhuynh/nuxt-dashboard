<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SSHKey } from '../../types/ssh'
import type { KeyFormPrefill } from '../../utils/keychain'

const props = defineProps<{
  sshKey?: SSHKey | null
  // Initial values when creating a key from imported files (ignored on edit).
  prefill?: KeyFormPrefill | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isEdit = computed(() => !!props.sshKey)

const schema = z.object({
  label: z.string().min(1, 'Required'),
  keyType: z.string().min(1, 'Required'),
  publicKey: z.string().optional(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional()
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({})
const showPassphrase = ref(false)
const { reveal } = useRevealSecret()

// publicKey/label/keyType are non-secret and returned by the list API, so seed
// them straight from the row (or from imported-file `prefill` when creating).
// On edit, the stored privateKey/passphrase are loaded via ?reveal=true so the
// form shows existing material; on create they come from `prefill` (imported).
watch(open, async (isOpen) => {
  if (!isOpen) return
  const editingId = props.sshKey?.id
  state.label = props.sshKey?.label ?? props.prefill?.label ?? ''
  state.keyType = props.sshKey?.keyType ?? props.prefill?.keyType ?? 'ed25519'
  state.publicKey = props.sshKey?.publicKey ?? props.prefill?.publicKey ?? ''
  state.privateKey = editingId ? '' : (props.prefill?.privateKey ?? '')
  state.passphrase = ''
  showPassphrase.value = false

  if (editingId) {
    const revealed = await reveal<{ privateKey: string | null, passphrase: string | null }>(
      'ssh-keys', editingId, () => open.value && props.sshKey?.id === editingId)
    if (revealed) {
      state.privateKey = revealed.privateKey ?? ''
      state.passphrase = revealed.passphrase ?? ''
    }
  }
})

const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const d = event.data

  // Always send the non-secret fields (publicKey may be blank — it is optional);
  // only include secrets the user actually typed so a blank field can't
  // overwrite the stored ciphertext.
  const payload: Record<string, unknown> = {
    label: d.label,
    keyType: d.keyType,
    publicKey: d.publicKey ?? ''
  }
  if (d.privateKey) payload.privateKey = d.privateKey
  if (d.passphrase) payload.passphrase = d.passphrase

  try {
    if (isEdit.value && props.sshKey) {
      await $fetch(`/api/ssh-keys/${props.sshKey.id}`, { method: 'PUT', body: payload })
    } else {
      await $fetch('/api/ssh-keys', { method: 'POST', body: payload })
    }
    toast.add({ title: isEdit.value ? 'Key updated' : 'Key pasted', color: 'success' })
    open.value = false
    emit('saved')
  } catch {
    toast.add({ title: 'Could not save key', color: 'error' })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? 'Edit SSH key' : 'Paste SSH key'"
    :description="isEdit ? 'Update this SSH key.' : 'Paste an existing SSH key pair.'"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="flex gap-4">
          <UFormField label="Label" name="label" class="flex-1">
            <UInput v-model="state.label" placeholder="My laptop key" class="w-full" />
          </UFormField>
          <UFormField label="Type" name="keyType" class="w-32">
            <USelect v-model="state.keyType" :items="KEY_TYPE_ITEMS" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Private key" name="privateKey">
          <UTextarea
            v-model="state.privateKey"
            :rows="4"
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            class="w-full font-mono"
          />
        </UFormField>

        <UFormField label="Public key" name="publicKey">
          <UTextarea
            v-model="state.publicKey"
            :rows="3"
            placeholder="ssh-ed25519 AAAA…"
            class="w-full font-mono"
          />
        </UFormField>

        <UFormField label="Passphrase" name="passphrase">
          <UInput
            v-model="state.passphrase"
            :type="showPassphrase ? 'text' : 'password'"
            placeholder="Optional"
            class="w-full"
          >
            <template #trailing>
              <UButton
                :icon="showPassphrase ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                color="neutral"
                variant="link"
                size="sm"
                :aria-label="showPassphrase ? 'Hide passphrase' : 'Show passphrase'"
                @click="showPassphrase = !showPassphrase"
              />
            </template>
          </UInput>
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="open = false"
          />
          <UButton
            :label="isEdit ? 'Save' : 'Paste'"
            color="primary"
            type="submit"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
