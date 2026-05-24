<script setup lang="ts">
import type { MailpitMessage, MailpitMessageDetail, MailpitStatus } from '~/types'
import { breakpointsTailwind } from '@vueuse/core'

const toast = useToast()

// ── Mailpit status ───────────────────────────────────────────

const { data: mailpitStatus, refresh: refreshStatus } = await useFetch<MailpitStatus>('/api/mailpit/status', { lazy: true })

// ── Mailpit service management ───────────────────────────────

const { deploying, stopping, deploy, stop } = useMailpit()

async function deployMailpit() {
  try {
    await deploy()
    await refreshStatus()
    await refreshMessages()
    toast.add({ title: 'Mailpit deployed', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({
      title: err?.data?.statusMessage ?? err?.message ?? 'Failed to deploy Mailpit',
      color: 'error'
    })
  }
}

async function stopMailpit() {
  try {
    await stop()
    await refreshStatus()
    await refreshMessages()
    toast.add({ title: 'Mailpit stopped', color: 'success' })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({
      title: err?.data?.statusMessage ?? err?.message ?? 'Failed to stop Mailpit',
      color: 'error'
    })
  }
}

function openMailpitDashboard() {
  if (mailpitStatus.value?.dashboardUrl) {
    window.open(mailpitStatus.value.dashboardUrl, '_blank')
  }
}

// ── Messages ─────────────────────────────────────────────────

const { data: messagesData, status: messagesLoading, refresh: refreshMessages } = await useFetch<{ messages: MailpitMessage[] }>('/api/mailpit/messages', { lazy: true })

const selectedId = ref<string | null>(null)
const selectedMessage = ref<MailpitMessageDetail | null>(null)
const loadingDetail = ref(false)

const isDetailOpen = computed({
  get: () => !!selectedMessage.value,
  set: (v: boolean) => { if (!v) selectedMessage.value = null }
})

watch(selectedId, async (newId) => {
  if (!newId) {
    selectedMessage.value = null
    return
  }
  loadingDetail.value = true
  try {
    const msg = await $fetch<MailpitMessageDetail>(`/api/mailpit/messages/${newId}`)
    // Copy read status from list (detail API doesn't include Read)
    const listMsg = messagesData.value?.messages?.find(m => m.ID === newId)
    if (listMsg) {
      msg.Read = listMsg.Read
      // Auto-mark as read when opening an unread message
      if (!listMsg.Read) {
        listMsg.Read = true
        $fetch(`/api/mailpit/messages/${newId}/read`, {
          method: 'POST',
          body: { read: true }
        }).catch(() => {})
      }
    }
    selectedMessage.value = msg
  } catch {
    selectedMessage.value = null
  } finally {
    loadingDetail.value = false
  }
})

function openInMailpit(id: string) {
  if (mailpitStatus.value?.dashboardUrl) {
    window.open(`${mailpitStatus.value.dashboardUrl}/view/${id}`, '_blank')
  }
}

function onDeleted(_id: string) {
  selectedMessage.value = null
  selectedId.value = null
  refreshMessages()
}

function onToggledRead(id: string, read: boolean) {
  // Update the selected message's read status immediately
  if (selectedMessage.value) {
    selectedMessage.value.Read = read
  }
  // Also update the list
  if (messagesData.value?.messages) {
    const listMsg = messagesData.value.messages.find(m => m.ID === id)
    if (listMsg) listMsg.Read = read
  }
}

const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('lg')

// Auto-refresh messages every 30s when mailpit is running
const autoRefresh = ref<ReturnType<typeof setInterval> | null>(null)

watch(() => mailpitStatus.value?.running, (running) => {
  if (running) {
    refreshMessages()
    autoRefresh.value = setInterval(() => refreshMessages(), 30000)
  } else {
    if (autoRefresh.value) clearInterval(autoRefresh.value)
    autoRefresh.value = null
  }
})

onUnmounted(() => {
  if (autoRefresh.value) clearInterval(autoRefresh.value)
})
</script>

<template>
  <UDashboardPanel
    id="mail-list"
    :default-size="30"
    :min-size="22"
    :max-size="35"
    resizable
  >
    <UDashboardNavbar title="Mail">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
      <template #trailing>
        <div class="flex items-center gap-1.5">
          <UBadge
            v-if="mailpitStatus?.running"
            color="success"
            variant="subtle"
            size="xs"
          >
            Live
          </UBadge>
          <UButton
            v-if="mailpitStatus?.running"
            size="xs"
            variant="ghost"
            icon="i-lucide-external-link"
            label="Open Mailpit"
            @click="openMailpitDashboard"
          />
        </div>
      </template>
    </UDashboardNavbar>

    <!-- Status Banner: Not Running -->
    <div v-if="!mailpitStatus?.running" class="mx-4 mt-4 p-4 rounded-lg border border-default bg-elevated/30">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-mail" class="size-5 text-muted" />
          <div>
            <p class="text-sm font-semibold">Mailpit is not running</p>
            <p class="text-xs text-muted">Deploy Mailpit to capture and view emails</p>
          </div>
        </div>
        <UButton
          size="xs"
          color="success"
          icon="i-lucide-play"
          label="Deploy"
          :loading="deploying"
          @click="deployMailpit"
        />
      </div>
    </div>

    <!-- Status Banner: Running -->
    <div v-else class="mx-4 mt-4 mb-2 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UBadge color="success" variant="subtle" size="xs">Running</UBadge>
        <span class="text-xs text-muted">Capturing emails on port 1025</span>
      </div>
      <div class="flex items-center gap-1.5">
        <UButton
          size="xs"
          icon="i-lucide-refresh-cw"
          variant="ghost"
          @click="refreshMessages()"
        />
        <UButton
          size="xs"
          color="warning"
          icon="i-lucide-square"
          label="Stop"
          :loading="stopping"
          @click="stopMailpit"
        />
      </div>
    </div>

    <MailList
      v-if="mailpitStatus?.running"
      v-model="selectedId"
      :messages="messagesData?.messages || []"
      :loading="messagesLoading === 'pending'"
      @open="openInMailpit"
    />
  </UDashboardPanel>

  <MailDetail
    v-if="selectedMessage"
    :message="selectedMessage"
    @close="selectedMessage = null; selectedId = null"
    @deleted="onDeleted"
    @open="openInMailpit"
    @toggled-read="onToggledRead"
  />
  <div v-else-if="!loadingDetail" class="hidden lg:flex flex-1 items-center justify-center">
    <UIcon name="i-lucide-mail" class="size-32 text-dimmed" />
  </div>

  <!-- Mobile slideover for detail -->
  <ClientOnly>
    <USlideover v-if="isMobile" v-model:open="isDetailOpen">
      <template #content>
        <MailDetail
          v-if="selectedMessage"
          :message="selectedMessage"
          @close="selectedMessage = null; selectedId = null"
          @deleted="onDeleted"
          @open="openInMailpit"
          @toggled-read="onToggledRead"
        />
      </template>
    </USlideover>
  </ClientOnly>
</template>
