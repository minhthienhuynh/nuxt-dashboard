<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Group, Host, HostWithRelations, Identity, SSHKey, Tag } from '../../types/ssh'

const props = defineProps<{
  host?: Host | null
  groups: Group[]
  identities: Identity[]
  sshKeys: SSHKey[]
  tags: Tag[]
  // Pre-selected group when creating a host from inside a group.
  defaultGroupId?: string | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isEdit = computed(() => !!props.host)

const schema = z.object({
  label: z.string().optional(),
  address: z.string().min(1, 'Required'),
  // `v-model.number` on an empty/cleared field yields '' or NaN; normalize both
  // to undefined so the optional check passes instead of erroring on the field.
  port: z.preprocess(
    v => (v === '' || v === null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.number().int().positive().optional()
  ),
  username: z.string().optional(),
  authType: z.enum(['password', 'key']),
  password: z.string().optional(),
  sshKeyId: z.string().optional(),
  groupId: z.string().optional(),
  tags: z.array(z.string()).optional()
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({})
const showMore = ref(false)
const showPassword = ref(false)
const { reveal } = useRevealSecret()
// On edit, only reconcile tags once the host's current tags have loaded — a
// failed/in-flight load must not let an empty selection wipe existing links.
const tagsLoaded = ref(false)

// Credentials live on Identity, not Host. When editing, prefill from the host's
// linked identity; the stored password (if any) is loaded via ?reveal=true below.
const currentIdentity = computed(() =>
  props.host?.identityId ? props.identities.find(i => i.id === props.host!.identityId) ?? null : null)

watch(open, async (isOpen) => {
  if (!isOpen) return
  const identity = currentIdentity.value
  const hostId = props.host?.id
  state.label = props.host?.label ?? ''
  state.address = props.host?.address ?? ''
  state.port = props.host?.port ?? 22
  state.username = identity?.username ?? ''
  state.authType = identity?.authType ?? 'password'
  state.password = ''
  state.sshKeyId = identity?.authType === 'key' ? (identity.sshKeyId ?? SELECT_NONE) : SELECT_NONE
  // Edit: keep the host's group. Create: default to the group we're inside.
  state.groupId = props.host ? (props.host.groupId ?? SELECT_NONE) : (props.defaultGroupId ?? SELECT_NONE)
  state.tags = []
  tagsLoaded.value = !props.host?.id
  showMore.value = false
  showPassword.value = false

  // Preload the host's current tags when editing (the prop carries no relations).
  if (props.host?.id) {
    try {
      const full = await $fetch<HostWithRelations>(`/api/hosts/${props.host.id}?relations=true`)
      // Ignore a stale response if the form was closed/reopened for another host.
      if (open.value && props.host?.id === hostId) {
        // Guard a dangling link (tag deleted while the link lingered) so a null
        // tag can't throw here and block the form from opening.
        state.tags = full.tags.map(l => l.tag?.name).filter((n): n is string => !!n)
        tagsLoaded.value = true
      }
    } catch {
      // Leave tags unloaded so submit won't reconcile (and risk clearing) them.
    }
  }

  // Show the existing password when editing a host that uses a password identity.
  if (identity && identity.authType === 'password') {
    const revealed = await reveal<{ password: string | null }>(
      'identities', identity.id, () => open.value && props.host?.id === hostId)
    if (revealed) state.password = revealed.password ?? ''
  }
})

const groupItems = computed(() => [
  { label: 'No group', value: SELECT_NONE },
  ...props.groups.map(g => ({ label: g.name, value: g.id }))
])

// Key auth picks an SSH key straight from the Keychain; the linking Identity
// (username + key) is created/updated behind the scenes on submit.
const sshKeyItems = computed(() =>
  props.sshKeys.length
    ? props.sshKeys.map(k => ({ label: k.label, value: k.id }))
    : [{ label: 'No saved keys yet', value: SELECT_NONE }])

// Existing tag names plus any just-created ones, so freshly added tags stay
// rendered as selected options (the API find-or-creates them on save).
const tagSuggestions = computed(() => {
  const names = new Set(props.tags.map(t => t.name))
  for (const t of state.tags ?? []) names.add(t)
  return [...names]
})

// USelectMenu's create-item only emits the typed name; add it to the selection.
function onCreateTag(name: string) {
  const tag = name.trim()
  if (!tag) return
  if (!state.tags) state.tags = []
  if (!state.tags.includes(tag)) state.tags.push(tag)
}

const toast = useToast()

// Resolve the identity to attach to the host, creating or updating an Identity
// (vault-encrypts the password server-side) as needed.
async function resolveIdentityId(d: Schema): Promise<string | undefined> {
  if (d.authType === 'key') {
    if (!d.sshKeyId || d.sshKeyId === SELECT_NONE) return props.host?.identityId ?? undefined
    // Bundle username + chosen key into a key-based Identity. Reuse the host's
    // current identity only when it is already key-based (changing a shared
    // password identity's type would affect other hosts), else create one.
    const body = { username: d.username || 'root', authType: 'key', sshKeyId: d.sshKeyId }
    const existing = currentIdentity.value
    if (existing && existing.authType === 'key') {
      await $fetch(`/api/identities/${existing.id}`, { method: 'PUT', body })
      return existing.id
    }
    const created = await $fetch<Identity>('/api/identities', { method: 'POST', body })
    return created.id
  }
  // password needs a username to form an identity. Default to 'root'
  // when a password was given but the username was left blank (otherwise the
  // host would be saved with no credentials). With nothing to store, keep
  // whatever the host already had.
  const username = d.username || (d.password ? 'root' : '')
  if (!username) return props.host?.identityId ?? undefined

  const body: Record<string, unknown> = { username, authType: d.authType }
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

  // Key auth needs a chosen SSH key; don't silently save a host with no
  // credentials when the Keychain is empty or none is picked.
  if (d.authType === 'key' && (!d.sshKeyId || d.sshKeyId === SELECT_NONE)) {
    toast.add({ title: 'Select an SSH key — none are saved yet', color: 'error' })
    return
  }

  // strictObject on the server rejects empty strings on optional FKs, so only
  // include fields that carry a real value. Label defaults to the address.
  const payload: Record<string, unknown> = {
    label: d.label || d.address,
    address: d.address
  }
  if (d.port) payload.port = d.port
  // Group: a real id sets the link; "No group" clears it. On edit send an
  // explicit null so PUT unlinks the existing group (omitting it would keep the
  // old value); on create just omit it (defaults to no group).
  if (d.groupId && d.groupId !== SELECT_NONE) payload.groupId = d.groupId
  else if (isEdit.value) payload.groupId = null
  // Reconcile tags only when the current set is known (always on create, on edit
  // only after a successful preload) so a failed load can't clear existing links.
  if (tagsLoaded.value) payload.tags = d.tags ?? []

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

        <UFormField label="Label" name="label">
          <UInput v-model="state.label" placeholder="Optional — defaults to the address" class="w-full" />
        </UFormField>

        <USeparator label="SSH" />

        <UFormField label="Username" name="username">
          <UInput v-model="state.username" placeholder="root" class="w-full" />
        </UFormField>

        <UFormField label="Authentication" name="authType">
          <UButtonGroup class="w-full">
            <UButton
              v-for="opt in AUTH_TYPE_ITEMS"
              :key="opt.value"
              :label="opt.label"
              :color="state.authType === opt.value ? 'primary' : 'neutral'"
              :variant="state.authType === opt.value ? 'solid' : 'outline'"
              class="flex-1 justify-center"
              @click="state.authType = opt.value"
            />
          </UButtonGroup>
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
          <USelect v-model="state.sshKeyId" :items="sshKeyItems" class="w-full" />
        </UFormField>

        <UFormField label="Tags" name="tags">
          <USelectMenu
            v-model="state.tags"
            :items="tagSuggestions"
            multiple
            create-item
            icon="i-lucide-tag"
            placeholder="Add tags…"
            class="w-full"
            @create="onCreateTag"
          />
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
          <UFormField label="Group" name="groupId">
            <USelect v-model="state.groupId" :items="groupItems" class="w-full" />
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
