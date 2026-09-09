<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-8 sm:mb-10">
      <h1 class="font-display text-3xl sm:text-4xl text-ivory tracking-wide mb-2">History</h1>
      <p class="text-sm sm:text-base text-smoke">
        Conversations saved from Home while you were signed in.
      </p>
    </div>

    <div v-if="loading" class="text-gray-600 py-12">
      Loading conversations…
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-300"
    >
      {{ error }}
    </div>

    <div
      v-else-if="conversations.length === 0"
      class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center"
    >
      <p class="text-gray-700 mb-2 font-medium">No saved conversations yet</p>
      <p class="text-sm text-gray-500 mb-6">
        Ask a question on Home while signed in and it will appear here.
      </p>
      <NuxtLink
        to="/guide"
        class="inline-flex px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
      >
        Go to Home
      </NuxtLink>
    </div>

    <ul v-else class="grid gap-4">
      <li
        v-for="c in conversations"
        :key="c.id"
        class="rounded-xl border border-gray-200 bg-studio-slate shadow-sm hover:border-primary/50 transition-all p-5"
      >
        <div class="flex items-start justify-between gap-3">
          <NuxtLink :to="`/history/${c.id}`" class="min-w-0 flex-1">
            <h2 class="text-lg font-semibold text-gray-900 truncate">
              {{ c.title || 'Conversation' }}
            </h2>
            <p class="text-sm text-gray-500 line-clamp-2 mt-1">
              {{ c.preview || 'No preview' }}
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>{{ formatDate(c.created) }}</span>
              <span
                v-if="c.model"
                class="px-2 py-0.5 rounded bg-gray-200 text-gray-700"
              >{{ c.model }}</span>
            </div>
          </NuxtLink>
          <button
            type="button"
            class="shrink-0 text-sm text-gray-500 hover:text-red-500 px-2 py-1"
            :disabled="deletingId === c.id"
            @click="onDelete(c.id)"
          >
            {{ deletingId === c.id ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { ConversationListItem } from '~/types/conversation'

definePageMeta({
  middleware: 'auth'
})

useHead({ title: 'History' })

const { listConversations, deleteConversation } = useConversations()

const conversations = ref<ConversationListItem[]>([])
const loading = ref(true)
const error = ref('')
const deletingId = ref<string | null>(null)

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
  error.value = ''
  try {
    conversations.value = await listConversations()
  } catch (e) {
    console.error(e)
    error.value = 'Could not load history. If this is a new install, run npm run setup-db.'
  } finally {
    loading.value = false
  }
}

async function onDelete (id: string) {
  if (deletingId.value) return
  if (!globalThis.confirm('Delete this conversation and its messages?')) return
  deletingId.value = id
  try {
    await deleteConversation(id)
    conversations.value = conversations.value.filter((c) => c.id !== id)
  } catch (e) {
    console.error(e)
    error.value = 'Could not delete that conversation.'
  } finally {
    deletingId.value = null
  }
}

onMounted(() => {
  void load()
})
</script>
