<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-6 flex items-center justify-between gap-4">
      <NuxtLink
        to="/history"
        class="text-sm text-smoke hover:text-primary transition-colors"
      >
        ← History
      </NuxtLink>
      <button
        v-if="conversation"
        type="button"
        class="text-sm text-gray-500 hover:text-red-500 disabled:opacity-50"
        :disabled="deleting"
        @click="onDelete"
      >
        {{ deleting ? 'Deleting…' : 'Delete' }}
      </button>
    </div>

    <div v-if="loading" class="text-gray-600 py-12">Loading conversation…</div>

    <div
      v-else-if="!conversation"
      class="rounded-xl border border-gray-200 bg-studio-slate p-8 text-center"
    >
      <p class="text-gray-700 font-medium mb-2">Conversation not found</p>
      <p class="text-sm text-gray-500 mb-6">
        It may have been deleted, or it belongs to another account.
      </p>
      <NuxtLink
        to="/history"
        class="inline-flex px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg"
      >
        Back to History
      </NuxtLink>
    </div>

    <div v-else>
      <div class="mb-8">
        <h1 class="font-display text-3xl sm:text-4xl text-ivory tracking-wide mb-2">
          {{ conversation.title }}
        </h1>
        <p class="text-sm text-smoke">
          {{ formatDate(conversation.created) }}
          <span v-if="modelUsed"> · {{ modelUsed }}</span>
        </p>
      </div>

      <div class="space-y-4">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[92%] rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm"
            :class="msg.role === 'user'
              ? 'bg-primary text-gray-950'
              : 'bg-studio-slate border border-gray-200 text-gray-800'"
          >
            <p class="text-[11px] uppercase tracking-wide mb-1 opacity-70">{{ msg.role }}</p>
            <p class="whitespace-pre-wrap">{{ msg.content }}</p>
            <p
              v-if="msg.role === 'assistant' && msg.model"
              class="mt-2 text-[11px] text-gray-500"
            >
              {{ msg.model }}
            </p>
          </div>
        </div>
      </div>

      <div class="mt-10">
        <NuxtLink
          to="/guide"
          class="inline-flex px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg"
        >
          Continue in Home
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConversationMessageRecord, ConversationRecord } from '~/types/conversation'

definePageMeta({
  middleware: 'auth'
})

const route = useRoute()
const router = useRouter()
const { getConversation, listMessages, deleteConversation } = useConversations()

const conversation = ref<ConversationRecord | null>(null)
const messages = ref<ConversationMessageRecord[]>([])
const loading = ref(true)
const deleting = ref(false)

const modelUsed = computed(() => {
  const last = [...messages.value].reverse().find((m) => m.role === 'assistant' && m.model)
  return last?.model || ''
})

useHead({
  title: computed(() => conversation.value?.title || 'Conversation')
})

function formatDate (iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

async function load () {
  loading.value = true
  const id = String(route.params.id || '')
  try {
    const conv = await getConversation(id)
    conversation.value = conv
    messages.value = conv ? await listMessages(id) : []
  } catch (e) {
    console.error(e)
    conversation.value = null
    messages.value = []
  } finally {
    loading.value = false
  }
}

async function onDelete () {
  if (!conversation.value || deleting.value) return
  if (!globalThis.confirm('Delete this conversation and its messages?')) return
  deleting.value = true
  try {
    await deleteConversation(conversation.value.id)
    await router.push('/history')
  } catch (e) {
    console.error(e)
    deleting.value = false
  }
}

onMounted(() => {
  void load()
})
</script>
