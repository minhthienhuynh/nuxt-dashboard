<script setup lang="ts">
import { format } from 'date-fns'
import type { MailpitMessageDetail } from '~/types'

const props = defineProps<{
  message: MailpitMessageDetail
}>()

const emit = defineEmits<{
  close: []
  deleted: [id: string]
  open: [id: string]
  toggledRead: [id: string, read: boolean]
}>()

const toast = useToast()
const deleting = ref(false)
const togglingRead = ref(false)

async function handleDelete() {
  deleting.value = true
  try {
    await $fetch(`/api/mailpit/messages/${props.message.ID}`, { method: 'DELETE' })
    toast.add({ title: 'Email deleted', color: 'success' })
    emit('deleted', props.message.ID)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({
      title: err?.data?.statusMessage ?? err?.message ?? 'Failed to delete',
      color: 'error'
    })
  } finally {
    deleting.value = false
  }
}

async function toggleRead() {
  togglingRead.value = true
  const newRead = !props.message.Read
  try {
    await $fetch(`/api/mailpit/messages/${props.message.ID}/read`, {
      method: 'POST',
      body: { read: newRead }
    })
    emit('toggledRead', props.message.ID, newRead)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string }
    toast.add({
      title: err?.data?.statusMessage ?? err?.message ?? 'Failed to update',
      color: 'error'
    })
  } finally {
    togglingRead.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="mail-detail">
    <UDashboardNavbar :title="message.Subject || '(no subject)'" :toggle="false">
      <template #leading>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          class="-ms-1.5"
          @click="emit('close')"
        />
      </template>

      <template #right>
        <UButton
          v-if="message.Read !== undefined"
          :icon="message.Read ? 'i-lucide-mail' : 'i-lucide-mail-open'"
          color="neutral"
          variant="ghost"
          :label="message.Read ? 'Unread' : 'Read'"
          :loading="togglingRead"
          @click="toggleRead"
        />
        <UButton
          icon="i-lucide-external-link"
          color="neutral"
          variant="ghost"
          label="Mailpit"
          @click="emit('open', props.message.ID)"
        />
        <UButton
          icon="i-lucide-trash"
          color="neutral"
          variant="ghost"
          :loading="deleting"
          @click="handleDelete"
        />
      </template>
    </UDashboardNavbar>

    <div class="flex flex-col sm:flex-row justify-between gap-1 p-4 sm:px-6 border-b border-default">
      <div class="flex items-start gap-4 sm:my-1.5">
        <UAvatar :alt="message.From?.Name || message.From?.Address || '?'" size="3xl" />
        <div class="min-w-0">
          <p class="font-semibold text-highlighted">
            {{ message.From?.Name || message.From?.Address || 'Unknown' }}
          </p>
          <p class="text-muted text-sm">
            {{ message.From?.Address }}
          </p>
          <p v-if="message.To?.length" class="text-muted text-xs mt-1">
            To: {{ message.To.map(t => t.Address).join(', ') }}
          </p>
        </div>
      </div>
      <p class="max-sm:pl-16 text-muted text-sm sm:mt-2">
        {{ format(new Date(message.Date), 'dd MMM yyyy HH:mm') }}
      </p>
    </div>

    <div class="flex-1 p-4 sm:p-6 overflow-y-auto">
      <div v-if="message.HTML" class="mailpit-html" v-html="message.HTML" />
      <pre v-else class="whitespace-pre-wrap font-sans text-sm">{{ message.Text }}</pre>

      <div v-if="message.Attachments?.length" class="mt-6 border-t border-default pt-4">
        <h4 class="text-sm font-semibold mb-2">Attachments ({{ message.Attachments.length }})</h4>
        <div class="flex flex-wrap gap-2">
          <UBadge
            v-for="att in message.Attachments"
            :key="att.PartID"
            variant="subtle"
          >
            {{ att.FileName }} ({{ (att.Size / 1024).toFixed(1) }} KB)
          </UBadge>
        </div>
      </div>
    </div>
  </UDashboardPanel>
</template>
