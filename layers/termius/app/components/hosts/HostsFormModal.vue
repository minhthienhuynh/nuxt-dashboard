<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Group, Host, Identity } from '../../types/ssh'

const props = defineProps<{
  host?: Host | null
  groups: Group[]
  identities: Identity[]
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isEdit = computed(() => !!props.host)

// Reka UI (USelect) forbids an empty-string item value (reserved for clearing),
// so the "none" option uses a non-empty sentinel — host/identity ids are UUIDs
// and the OS values are a fixed enum, so 'none' never collides.
const NONE = 'none'

const schema = z.object({
  label: z.string().optional(),
  address: z.string().min(1, 'Required'),
  port: z.number().int().positive().optional(),
  username: z.string().optional(),
  authType: z.enum(['password', 'key', 'agent']),
  password: z.string().optional(),
  keyIdentityId: z.string().optional(),
  os: z.string().optional(),
  description: z.string().optional(),
  groupId: z.string().optional()
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({})
const showMore = ref(false)

// Credentials live on Identity, not Host. When editing, prefill from the host's
// linked identity (the password is never returned by the API — blank means
// "unchanged").
const currentIdentity = computed(() =>
  props.host?.identityId ? props.identities.find(i => i.id === props.host!.identityId) ?? null : null)

watch(open, (isOpen) => {
  if (!isOpen) return
  const identity = currentIdentity.value
  state.label = props.host?.label ?? ''
  state.address = props.host?.address ?? ''
  state.port = props.host?.port ?? 22
  state.username = identity?.username ?? ''
  state.authType = identity?.authType ?? 'password'
  state.password = ''
  state.keyIdentityId = identity?.authType === 'key' ? identity.id : NONE
  state.os = props.host?.os ?? NONE
  state.description = props.host?.description ?? ''
  state.groupId = props.host?.groupId ?? NONE
  showMore.value = false
})

const authTypeItems = [
  { label: 'Password', value: 'password' },
  { label: 'Key', value: 'key' },
  { label: 'SSH Agent', value: 'agent' }
]

const osItems = [
  { label: '—', value: NONE },
  { label: 'Linux', value: 'linux' },
  { label: 'macOS', value: 'macos' },
  { label: 'Windows', value: 'windows' },
  { label: 'Other', value: 'other' }
]

const groupItems = computed(() => [
  { label: 'No group', value: NONE },
  ...props.groups.map(g => ({ label: g.name, value: g.id }))
])

// Key auth re-uses a saved key-based identity from the Keychain (creating new
// SSH keys is a separate, deferred flow — it needs the public key material).
const keyIdentityItems = computed(() => {
  const keys = props.identities.filter(i => i.authType === 'key')
  return keys.length
    ? keys.map(i => ({ label: i.label || i.username, value: i.id }))
    : [{ label: 'No saved keys yet', value: NONE }]
})

const toast = useToast()

// Resolve the identity to attach to the host, creating or updating an Identity
// (vault-encrypts the password server-side) as needed.
async function resolveIdentityId(d: Schema): Promise<string | undefined> {
  if (d.authType === 'key') {
    return d.keyIdentityId && d.keyIdentityId !== NONE ? d.keyIdentityId : props.host?.identityId ?? undefined
  }
  // password / agent need a username to form an identity; without one, keep
  // whatever the host already had.
  if (!d.username) return props.host?.identityId ?? undefined

  const body: Record<string, unknown> = { username: d.username, authType: d.authType }
  if (d.authType === 'password' && d.password) body.password = d.password

  const existing = currentIdentity.value
  if (existing && existing.authType !== 'key') {
    await $fetch(`/api/identities/${existing.id}`, { method: 'PUT', body })
    return existing.id
  }
  const created = await $fetch<Identity>('/api/identities', { method: 'POST', body })
  return created.id
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const d = event.data
  // strictObject on the server rejects empty strings on optional FKs, so only
  // include fields that carry a real value. Label defaults to the address.
  const payload: Record<string, unknown> = {
    label: d.label || d.address,
    address: d.address
  }
  if (d.port) payload.port = d.port
  if (d.os && d.os !== NONE) payload.os = d.os
  if (d.description) payload.description = d.description
  if (d.groupId && d.groupId !== NONE) payload.groupId = d.groupId

  try {
    const identityId = await resolveIdentityId(d)
    if (identityId) payload.identityId = identityId

    if (isEdit.value && props.host) {
      await $fetch(`/api/hosts/${props.host.id}`, { method: 'PUT', body: payload })
    } else {
      await $fetch('/api/hosts', { method: 'POST', body: payload })
    }
    toast.add({ title: isEdit.value ? 'Host updated' : 'Host created', color: 'success' })
    open.value = false
    emit('saved')
  } catch {
    toast.add({ title: 'Could not save host', color: 'error' })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? 'Edit host' : 'New host'"
    :description="isEdit ? 'Update this SSH host.' : 'Add a new SSH host.'"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="flex gap-4">
          <UFormField label="Address" name="address" class="flex-1">
            <UInput v-model="state.address" placeholder="10.0.0.1 or host.example" class="w-full" />
          </UFormField>
          <UFormField label="Port" name="port" class="w-24">
            <UInput v-model.number="state.port" type="number" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Username" name="username">
          <UInput v-model="state.username" placeholder="root" class="w-full" />
        </UFormField>

        <UFormField label="Authentication" name="authType">
          <USelect v-model="state.authType" :items="authTypeItems" class="w-full" />
        </UFormField>

        <UFormField
          v-if="state.authType === 'password'"
          label="Password"
          name="password"
        >
          <UInput
            v-model="state.password"
            type="password"
            :placeholder="isEdit ? 'Unchanged' : 'Enter password'"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-else-if="state.authType === 'key'"
          label="SSH key"
          name="keyIdentityId"
        >
          <USelect v-model="state.keyIdentityId" :items="keyIdentityItems" class="w-full" />
        </UFormField>

        <UFormField label="Label" name="label">
          <UInput v-model="state.label" placeholder="Optional — defaults to the address" class="w-full" />
        </UFormField>

        <UButton
          :label="showMore ? 'Show less' : 'Show more'"
          :icon="showMore ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          color="neutral"
          variant="link"
          size="xs"
          class="-ml-1.5"
          @click="showMore = !showMore"
        />

        <template v-if="showMore">
          <div class="flex gap-4">
            <UFormField label="OS" name="os" class="flex-1">
              <USelect v-model="state.os" :items="osItems" class="w-full" />
            </UFormField>
            <UFormField label="Group" name="groupId" class="flex-1">
              <USelect v-model="state.groupId" :items="groupItems" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Description" name="description">
            <UTextarea v-model="state.description" :rows="2" class="w-full" />
          </UFormField>
        </template>

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
