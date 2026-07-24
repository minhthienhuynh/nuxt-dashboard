<script setup lang="ts">
import { computed, ref } from 'vue'
import { format } from 'date-fns'
import { useSftpConnection } from '../../composables/useSftpConnection'
import { joinSftpPath, parentSftpPath, sftpBreadcrumbs } from '../../utils/sftp-path'
import { formatSftpSize } from '../../utils/sftp-format'
import { PREVIEW_MAX_SIZE, looksBinary } from '../../utils/sftp-preview'
import type { SftpEntry } from '#shared/sftp-protocol'

const props = defineProps<{
  hostId: string
}>()

const { status, currentPath, entries, loading, error, list, mkdir, rename, remove, refresh, reconnect } = useSftpConnection(props.hostId)

const toast = useToast()

// Directories first, then alphabetical — the conventional file-manager order.
const sortedEntries = computed(() => [...entries.value].sort((a, b) => {
  if (a.type === 'directory' && b.type !== 'directory') return -1
  if (a.type !== 'directory' && b.type === 'directory') return 1
  return a.name.localeCompare(b.name)
}))

// Hidden until the initial listing resolves currentPath to an absolute path
// (it starts as '.', which is not a meaningful breadcrumb).
const breadcrumbItems = computed(() => {
  if (!currentPath.value.startsWith('/')) return []
  const crumbs = sftpBreadcrumbs(currentPath.value)
  return crumbs.map((c, i) =>
    i === crumbs.length - 1
      ? { label: c.name }
      : { label: c.name, class: 'cursor-pointer', onClick: () => navigate(c.path) })
})

function entryIcon(type: SftpEntry['type']): string {
  if (type === 'directory') return 'i-lucide-folder'
  if (type === 'symlink') return 'i-lucide-link'
  if (type === 'file') return 'i-lucide-file'
  return 'i-lucide-file-question'
}

function formatDate(epochSeconds: number): string {
  return format(new Date(epochSeconds * 1000), 'dd MMM yyyy HH:mm')
}

async function navigate(path: string) {
  try {
    await list(path)
  } catch (err) {
    toast.add({ title: 'Could not open directory', description: (err as Error).message, color: 'error' })
  }
}

// Directories navigate into themselves; anything else opens a text preview
// (openPreview handles the too-large/binary cases on its own).
function openEntry(entry: SftpEntry) {
  if (entry.type === 'directory') {
    navigate(joinSftpPath(currentPath.value, entry.name))
  } else {
    openPreview(entry)
  }
}

function goUp() {
  navigate(parentSftpPath(currentPath.value))
}

// --- Download ----------------------------------------------------------
// A same-origin download URL, opened via a throwaway anchor so the browser's
// own download handling (Content-Disposition from the server) takes over
// without navigating this window away from the file browser.
function downloadEntry(entry: SftpEntry) {
  const path = joinSftpPath(currentPath.value, entry.name)
  const url = `/api/sftp/download?hostId=${encodeURIComponent(props.hostId)}&path=${encodeURIComponent(path)}`
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// --- Preview -----------------------------------------------------------
// Reuses the download endpoint (fetch, not the control WebSocket) to read a
// file's bytes, then gates on size and a binary heuristic before rendering
// text. previewToken guards against a stale fetch (from a previously opened
// file) clobbering a newer one's state if it resolves after the user has
// already moved on to another file.
const previewOpen = ref(false)
const previewTarget = ref<SftpEntry | null>(null)
const previewLoading = ref(false)
const previewError = ref<string | null>(null)
const previewContent = ref('')
let previewToken = 0

async function openPreview(entry: SftpEntry) {
  const token = ++previewToken
  previewTarget.value = entry
  previewOpen.value = true
  previewContent.value = ''
  previewError.value = null

  if (entry.size > PREVIEW_MAX_SIZE) {
    previewError.value = `File is too large to preview (${formatSftpSize(entry.size)}). Download it instead.`
    return
  }

  previewLoading.value = true
  try {
    const path = joinSftpPath(currentPath.value, entry.name)
    const url = `/api/sftp/download?hostId=${encodeURIComponent(props.hostId)}&path=${encodeURIComponent(path)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Could not load file (${res.status})`)
    const buffer = await res.arrayBuffer()
    if (token !== previewToken) return // superseded by a newer preview request
    if (looksBinary(buffer)) {
      previewError.value = 'This file looks like binary data and can’t be shown as text.'
      return
    }
    previewContent.value = new TextDecoder('utf-8').decode(buffer)
  } catch (err) {
    if (token === previewToken) previewError.value = (err as Error).message
  } finally {
    if (token === previewToken) previewLoading.value = false
  }
}

function downloadPreviewTarget() {
  if (previewTarget.value) downloadEntry(previewTarget.value)
}

// --- Upload --------------------------------------------------------------
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadProgress = ref(0)

function triggerUpload() {
  fileInput.value?.click()
}

// XHR (not fetch) so upload progress is observable — fetch has no portable
// request-body progress event. onProgress receives this file's own 0-1
// fraction; the caller combines it with the file's position in the batch so
// the bar climbs monotonically across multiple files instead of resetting.
function uploadFile(file: File, path: string, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const url = `/api/sftp/upload?hostId=${encodeURIComponent(props.hostId)}&path=${encodeURIComponent(path)}`
    xhr.open('POST', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(file)
  })
}

async function onFilesPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // reset so picking the same file again re-fires change
  if (!files.length) return
  uploading.value = true
  uploadProgress.value = 0
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      const path = joinSftpPath(currentPath.value, file.name)
      await uploadFile(file, path, (fraction) => {
        uploadProgress.value = Math.round(((i + fraction) / files.length) * 100)
      })
    }
    uploadProgress.value = 100
    toast.add({ title: files.length > 1 ? 'Files uploaded' : 'File uploaded', color: 'success' })
    await refresh()
  } catch (err) {
    toast.add({ title: 'Upload failed', description: (err as Error).message, color: 'error' })
  } finally {
    uploading.value = false
  }
}

// A name that is joined onto the current directory via joinSftpPath, so a
// stray '/' would silently target a different (possibly nested) path instead
// of failing loudly — reject it up front rather than letting mkdir/rename move
// something to an unintended location.
function isValidEntryName(name: string): boolean {
  return name.length > 0 && !name.includes('/')
}

// --- New folder ------------------------------------------------------------
const mkdirOpen = ref(false)
const mkdirName = ref('')

function openMkdir() {
  mkdirName.value = ''
  mkdirOpen.value = true
}

async function submitMkdir() {
  const name = mkdirName.value.trim()
  if (!isValidEntryName(name)) {
    toast.add({ title: 'Folder name can’t be empty or contain “/”', color: 'error' })
    return
  }
  try {
    await mkdir(joinSftpPath(currentPath.value, name))
    mkdirOpen.value = false
    await refresh()
  } catch (err) {
    toast.add({ title: 'Could not create folder', description: (err as Error).message, color: 'error' })
  }
}

// --- Rename ------------------------------------------------------------
const renameOpen = ref(false)
const renameTarget = ref<SftpEntry | null>(null)
const renameName = ref('')

function openRename(entry: SftpEntry) {
  renameTarget.value = entry
  renameName.value = entry.name
  renameOpen.value = true
}

async function submitRename() {
  const name = renameName.value.trim()
  if (!renameTarget.value) return
  if (!isValidEntryName(name)) {
    toast.add({ title: 'Name can’t be empty or contain “/”', color: 'error' })
    return
  }
  const from = joinSftpPath(currentPath.value, renameTarget.value.name)
  const to = joinSftpPath(currentPath.value, name)
  try {
    await rename(from, to)
    renameOpen.value = false
    await refresh()
  } catch (err) {
    toast.add({ title: 'Could not rename', description: (err as Error).message, color: 'error' })
  }
}

// --- Delete (confirmed) ------------------------------------------------------
const deleteOpen = ref(false)
const deleteTarget = ref<SftpEntry | null>(null)

function openDelete(entry: SftpEntry) {
  deleteTarget.value = entry
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  const path = joinSftpPath(currentPath.value, deleteTarget.value.name)
  try {
    await remove(path, deleteTarget.value.type === 'directory')
    deleteOpen.value = false
    await refresh()
  } catch (err) {
    toast.add({ title: 'Could not delete', description: (err as Error).message, color: 'error' })
  }
}
</script>

<template>
  <div class="flex flex-col h-full border border-default rounded-lg overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-2 py-2 border-b border-default bg-elevated/40">
      <UTooltip text="Up">
        <UButton
          icon="i-lucide-arrow-up"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="currentPath === '/' || status !== 'connected' || loading"
          aria-label="Parent directory"
          @click="goUp"
        />
      </UTooltip>
      <UBreadcrumb :items="breadcrumbItems" class="flex-1 min-w-0" />
      <UTooltip text="New folder">
        <UButton
          icon="i-lucide-folder-plus"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="status !== 'connected' || loading"
          aria-label="New folder"
          @click="openMkdir"
        />
      </UTooltip>
      <UTooltip text="Upload">
        <UButton
          icon="i-lucide-upload"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="status !== 'connected' || loading"
          aria-label="Upload files"
          @click="triggerUpload"
        />
      </UTooltip>
      <UTooltip text="Refresh">
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="xs"
          :loading="loading"
          :disabled="status !== 'connected' || loading"
          aria-label="Refresh"
          @click="refresh"
        />
      </UTooltip>
      <input
        ref="fileInput"
        type="file"
        multiple
        class="hidden"
        @change="onFilesPicked"
      >
    </div>

    <div v-if="uploading" class="px-3 py-1.5 border-b border-default">
      <UProgress :model-value="uploadProgress" size="sm" />
    </div>

    <!-- Connection status -->
    <div
      v-if="status !== 'connected'"
      class="flex items-center justify-center gap-2 px-3 py-2 text-sm border-b border-default bg-elevated/40"
    >
      <template v-if="status === 'connecting'">
        <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin text-dimmed" />
        <span class="text-dimmed">Connecting…</span>
      </template>
      <template v-else>
        <UIcon name="i-lucide-circle-off" class="size-4 text-error" />
        <span class="text-dimmed">{{ error ?? 'Disconnected' }}</span>
        <UButton
          label="Reconnect"
          size="xs"
          color="neutral"
          variant="soft"
          @click="reconnect"
        />
      </template>
    </div>

    <!-- Entries -->
    <div class="flex-1 overflow-y-auto relative">
      <div v-if="loading && !sortedEntries.length" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
      </div>

      <div v-else-if="!sortedEntries.length" class="flex flex-col items-center justify-center py-12 text-dimmed">
        <UIcon name="i-lucide-folder-open" class="size-10 mb-3" />
        <p class="text-sm">
          This directory is empty.
        </p>
      </div>

      <table v-else class="w-full text-sm">
        <thead class="sticky top-0 bg-elevated/50 text-xs text-dimmed uppercase">
          <tr>
            <th class="text-left font-medium py-2 px-3">
              Name
            </th>
            <th class="text-right font-medium py-2 px-3">
              Size
            </th>
            <th class="text-right font-medium py-2 px-3">
              Modified
            </th>
            <th class="py-2 px-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="entry in sortedEntries" :key="entry.name" class="group hover:bg-primary/5">
            <td class="py-1.5 px-3 min-w-0">
              <button
                type="button"
                class="flex items-center gap-2 min-w-0 text-left hover:text-primary"
                @click="openEntry(entry)"
              >
                <UIcon :name="entryIcon(entry.type)" class="size-4 shrink-0 text-dimmed" />
                <span class="truncate">{{ entry.name }}</span>
              </button>
            </td>
            <td class="py-1.5 px-3 text-right text-dimmed whitespace-nowrap">
              {{ entry.type === 'directory' ? '—' : formatSftpSize(entry.size) }}
            </td>
            <td class="py-1.5 px-3 text-right text-dimmed whitespace-nowrap">
              {{ formatDate(entry.mtime) }}
            </td>
            <td class="py-1.5 px-3">
              <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                <UTooltip v-if="entry.type !== 'directory'" text="Download">
                  <UButton
                    icon="i-lucide-download"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    aria-label="Download"
                    @click="downloadEntry(entry)"
                  />
                </UTooltip>
                <UTooltip text="Rename">
                  <UButton
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    aria-label="Rename"
                    @click="openRename(entry)"
                  />
                </UTooltip>
                <UTooltip text="Delete">
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="xs"
                    aria-label="Delete"
                    @click="openDelete(entry)"
                  />
                </UTooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Dims the current listing while navigating/refreshing so the table
           isn't clickable mid-request, without discarding it like a full
           reload would. -->
      <div
        v-if="loading && sortedEntries.length"
        class="absolute inset-0 z-10 flex items-center justify-center bg-default/60 cursor-wait"
      >
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
      </div>
    </div>

    <UModal v-model:open="mkdirOpen" title="New folder">
      <template #body>
        <UInput
          v-model="mkdirName"
          placeholder="Folder name"
          autofocus
          class="w-full"
          @keydown.enter="submitMkdir"
        />
        <div class="flex justify-end gap-2 mt-4">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="mkdirOpen = false"
          />
          <UButton
            label="Create"
            color="primary"
            loading-auto
            @click="submitMkdir"
          />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="renameOpen" title="Rename">
      <template #body>
        <UInput
          v-model="renameName"
          placeholder="New name"
          autofocus
          class="w-full"
          @keydown.enter="submitRename"
        />
        <div class="flex justify-end gap-2 mt-4">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="renameOpen = false"
          />
          <UButton
            label="Rename"
            color="primary"
            loading-auto
            @click="submitRename"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteOpen"
      :title="`Delete ${deleteTarget?.type === 'directory' ? 'folder' : 'file'} “${deleteTarget?.name}”`"
      description="This action cannot be undone."
    >
      <template #body>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="subtle"
            @click="deleteOpen = false"
          />
          <UButton
            label="Delete"
            color="error"
            loading-auto
            @click="confirmDelete"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="previewOpen"
      :title="previewTarget?.name"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <div v-if="previewLoading" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
        </div>

        <div
          v-else-if="previewError"
          class="flex flex-col items-center gap-2 py-8 text-center text-sm text-dimmed"
        >
          <UIcon name="i-lucide-file-warning" class="size-6" />
          <p>{{ previewError }}</p>
        </div>

        <pre
          v-else
          class="max-h-[60vh] overflow-auto rounded-md bg-elevated/50 p-3 text-xs font-mono whitespace-pre-wrap break-words"
        >{{ previewContent }}</pre>

        <div class="flex justify-end gap-2 mt-4">
          <UButton
            label="Close"
            color="neutral"
            variant="subtle"
            @click="previewOpen = false"
          />
          <UButton
            label="Download"
            icon="i-lucide-download"
            color="primary"
            variant="soft"
            @click="downloadPreviewTarget"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
