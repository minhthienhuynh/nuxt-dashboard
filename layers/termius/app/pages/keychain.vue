<script setup lang="ts">
import { computed, ref } from 'vue'
import { filterKeychainBySearch, parseImportedKeyFiles } from '../utils/keychain'
import type { KeyFormPrefill } from '../utils/keychain'
import type { Identity, SSHKey } from '../types/ssh'

// --- Data -------------------------------------------------------------------
const { data: sshKeys, refresh: refreshKeys } = await useFetch<SSHKey[]>('/api/ssh-keys', { default: () => [], lazy: true })
const { data: identities, refresh: refreshIdentities } = await useFetch<Identity[]>('/api/identities', { default: () => [], lazy: true })

const toast = useToast()

const tabItems = [
  { label: 'SSH Keys', icon: 'i-lucide-key-round', slot: 'keys' as const },
  { label: 'Identities', icon: 'i-lucide-user-round', slot: 'identities' as const }
]

// --- Search + filtering -----------------------------------------------------
const keySearch = ref('')
const identitySearch = ref('')

const visibleKeys = computed(() => filterKeychainBySearch(sshKeys.value, keySearch.value, k => [k.label]))
const visibleIdentities = computed(() =>
  filterKeychainBySearch(identities.value, identitySearch.value, i => [i.label, i.username]))

// Resolve a key-based identity's linked key to its label for display.
const keyLabelById = computed(() => new Map(sshKeys.value.map(k => [k.id, k.label])))

// --- Key create / edit ------------------------------------------------------
const keyModalOpen = ref(false)
const editingKey = ref<SSHKey | null>(null)
const keyPrefill = ref<KeyFormPrefill | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// Paste: open a blank form to paste key material by hand.
function pasteKey() {
  editingKey.value = null
  keyPrefill.value = null
  keyModalOpen.value = true
}

// Import: pick key file(s) from disk, read them, and open the form prefilled.
function triggerImport() {
  fileInput.value?.click()
}

async function onFilesPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // reset so picking the same file again re-fires change
  if (!files.length) return
  const parsed = await Promise.all(files.map(async f => ({ name: f.name, content: await f.text() })))
  const prefill = parseImportedKeyFiles(parsed)
  // Surface a clear error instead of silently opening a blank form when none of
  // the selected files looked like an OpenSSH public or private key.
  if (!prefill.publicKey && !prefill.privateKey) {
    toast.add({ title: 'No SSH key found in the selected file(s)', color: 'error' })
    return
  }
  editingKey.value = null
  keyPrefill.value = prefill
  keyModalOpen.value = true
}

function editKey(sshKey: SSHKey) {
  editingKey.value = sshKey
  keyPrefill.value = null
  keyModalOpen.value = true
}

// --- Identity create / edit -------------------------------------------------
const identityModalOpen = ref(false)
const editingIdentity = ref<Identity | null>(null)

function addIdentity() {
  editingIdentity.value = null
  identityModalOpen.value = true
}

function editIdentity(identity: Identity) {
  editingIdentity.value = identity
  identityModalOpen.value = true
}

// --- Delete -----------------------------------------------------------------
const deleteOpen = ref(false)
const deleteResource = ref<'ssh-keys' | 'identities'>('ssh-keys')
const deleteId = ref<string | null>(null)
const deleteLabel = ref('')

function deleteKey(sshKey: SSHKey) {
  deleteResource.value = 'ssh-keys'
  deleteId.value = sshKey.id
  deleteLabel.value = sshKey.label
  deleteOpen.value = true
}

function deleteIdentity(identity: Identity) {
  deleteResource.value = 'identities'
  deleteId.value = identity.id
  deleteLabel.value = identity.label || identity.username
  deleteOpen.value = true
}

async function onDeleted() {
  // Deleting a key clears the sshKeyId on identities that referenced it
  // (onDelete: SetNull), so refresh both lists.
  if (deleteResource.value === 'ssh-keys') {
    await Promise.all([refreshKeys(), refreshIdentities()])
  } else {
    await refreshIdentities()
  }
}
</script>

<template>
  <UDashboardPanel id="keychain">
    <UDashboardNavbar title="Keychain">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
    </UDashboardNavbar>

    <div class="flex flex-col flex-1 min-h-0 p-4">
      <UTabs :items="tabItems" class="flex-1" :unmount-on-hide="false">
        <!-- SSH Keys -->
        <template #keys>
          <div class="flex items-center gap-2 pt-4 pb-3">
            <UInput
              v-model="keySearch"
              icon="i-lucide-search"
              placeholder="Find a key…"
              class="flex-1"
            />
            <UButton label="Paste key" icon="i-lucide-clipboard-paste" @click="pasteKey" />
            <UButton
              label="Import key"
              icon="i-lucide-upload"
              color="neutral"
              variant="outline"
              @click="triggerImport"
            />
            <input
              ref="fileInput"
              type="file"
              multiple
              class="hidden"
              @change="onFilesPicked"
            >
          </div>

          <div
            v-if="visibleKeys.length"
            class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
          >
            <KeychainKeyCard
              v-for="key in visibleKeys"
              :key="key.id"
              :ssh-key="key"
              @edit="editKey(key)"
              @delete="deleteKey(key)"
            />
          </div>
          <div v-else class="flex flex-col items-center justify-center py-12 text-dimmed">
            <UIcon name="i-lucide-key-round" class="size-10 mb-3" />
            <p class="text-sm mb-3">
              {{ keySearch ? 'No keys match your search.' : 'No SSH keys yet.' }}
            </p>
            <div v-if="!keySearch" class="flex gap-2">
              <UButton
                label="Paste key"
                icon="i-lucide-clipboard-paste"
                variant="soft"
                @click="pasteKey"
              />
              <UButton
                label="Import key"
                icon="i-lucide-upload"
                color="neutral"
                variant="soft"
                @click="triggerImport"
              />
            </div>
          </div>
        </template>

        <!-- Identities -->
        <template #identities>
          <div class="flex items-center gap-2 pt-4 pb-3">
            <UInput
              v-model="identitySearch"
              icon="i-lucide-search"
              placeholder="Find an identity…"
              class="flex-1"
            />
            <UButton label="New identity" icon="i-lucide-plus" @click="addIdentity" />
          </div>

          <div
            v-if="visibleIdentities.length"
            class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
          >
            <KeychainIdentityCard
              v-for="identity in visibleIdentities"
              :key="identity.id"
              :identity="identity"
              :key-label="identity.sshKeyId ? keyLabelById.get(identity.sshKeyId) : null"
              @edit="editIdentity(identity)"
              @delete="deleteIdentity(identity)"
            />
          </div>
          <div v-else class="flex flex-col items-center justify-center py-12 text-dimmed">
            <UIcon name="i-lucide-user-round" class="size-10 mb-3" />
            <p class="text-sm mb-3">
              {{ identitySearch ? 'No identities match your search.' : 'No identities yet.' }}
            </p>
            <UButton
              v-if="!identitySearch"
              label="New identity"
              icon="i-lucide-plus"
              variant="soft"
              @click="addIdentity"
            />
          </div>
        </template>
      </UTabs>
    </div>

    <KeychainKeyFormModal
      v-model:open="keyModalOpen"
      :ssh-key="editingKey"
      :prefill="keyPrefill"
      @saved="refreshKeys"
    />

    <KeychainIdentityFormModal
      v-model:open="identityModalOpen"
      :identity="editingIdentity"
      :ssh-keys="sshKeys"
      @saved="refreshIdentities"
    />

    <KeychainDeleteModal
      :id="deleteId"
      v-model:open="deleteOpen"
      :resource="deleteResource"
      :label="deleteLabel"
      @deleted="onDeleted"
    />
  </UDashboardPanel>
</template>
