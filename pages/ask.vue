<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">Ask a Question</h1>

    <div v-if="authInitialized && isAuthenticated && activityStats" class="mb-8">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Your Activity</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:border-accent-cyan/50 transition-colors">
          <div class="flex items-center justify-between mb-3">
            <div class="w-12 h-12 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
          </div>
          <div class="text-3xl font-bold text-accent-cyan mb-1">{{ activityStats.questionsPosted }}</div>
          <div class="text-sm text-gray-600">Questions Posted</div>
        </div>

        <div class="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:border-accent-orange/50 transition-colors">
          <div class="flex items-center justify-between mb-3">
            <div class="w-12 h-12 rounded-lg bg-accent-orange/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-accent-orange" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
          <div class="text-3xl font-bold text-accent-orange mb-1">{{ activityStats.answersRated }}</div>
          <div class="text-sm text-gray-600">Answers Rated</div>
        </div>

        <div class="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:border-accent-purple/50 transition-colors">
          <div class="flex items-center justify-between mb-3">
            <div class="w-12 h-12 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
          <div class="text-3xl font-bold text-accent-purple mb-1">{{ activityStats.commentsMade }}</div>
          <div class="text-sm text-gray-600">Comments Made</div>
        </div>

        <div class="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:border-primary/50 transition-colors">
          <div class="flex items-center justify-between mb-3">
            <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div class="text-3xl font-bold text-primary mb-1">{{ activityStats.daysLoggedIn }}</div>
          <div class="text-sm text-gray-600">Days Logged In</div>
        </div>
      </div>
    </div>

    <div v-if="authInitialized && !isAuthenticated" class="mb-8 p-6 bg-amber-50 border-2 border-amber-200 rounded-lg">
      <div class="flex items-center gap-4">
        <div class="flex-shrink-0">
          <svg class="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-amber-900 mb-1">Login Required</h3>
          <p class="text-sm text-amber-800">
            You must be logged in to ask questions.
            <NuxtLink to="/login" class="underline font-semibold hover:text-amber-950">Log in</NuxtLink>
            or
            <NuxtLink to="/signup" class="underline font-semibold hover:text-amber-950">sign up</NuxtLink>
            to continue.
          </p>
        </div>
      </div>
    </div>

    <form @submit.prevent="submitQuestion" class="mb-8">
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <input
          v-model="questionText"
          type="text"
          placeholder="Enter your question..."
          :disabled="!authInitialized || !isAuthenticated"
          class="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          required
        >
        <button
          type="submit"
          :disabled="loading || !authInitialized || !isAuthenticated"
          class="px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {{ loading ? 'Querying...' : 'Submit' }}
        </button>
      </div>
    </form>

    <div v-if="responses && Object.keys(responses).length > 0">
      <h2 class="text-2xl font-semibold text-gray-900 mb-6">Responses</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ModelResponseCard
          v-for="(response, model) in responses"
          :key="model"
          :model="model"
          :response="response"
          class="h-[500px]"
          @update:rating="handleRatingUpdate"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { isAuthenticated, getUserId, initAuth } = useAuth()

const { success: showSuccess, error: showError } = useToast()
const questionText = ref('')
const responses = ref<Record<string, { answer: string; rating: number | null }>>({})
const loading = ref(false)
const activityStats = ref<Record<string, number> | null>(null)
const currentQuestionId = ref<string | null>(null)
const authInitialized = ref(false)

const fetchActivityStats = async () => {
  if (!isAuthenticated.value) return

  const userId = getUserId()
  if (!userId) return

  try {
    const stats = await $fetch<Record<string, number>>('/api/users/activity', {
      query: { userId }
    })
    activityStats.value = stats
  } catch (error: unknown) {
    activityStats.value = null
    if (import.meta.dev) {
      console.warn('Activity stats unavailable:', error instanceof Error ? error.message : error)
    }
  }
}

const MODELS = [
  'ChatGPT',
  'Claude',
  'Gemini',
  'Mistral',
  'DeepSeek',
  'LLaMA',
  'Grok',
  'Perplexity'
]

const submitQuestion = async () => {
  if (!questionText.value.trim()) return

  if (!isAuthenticated.value) {
    showError('You must be logged in to ask questions. Please log in first.')
    return
  }

  loading.value = true
  responses.value = {}

  MODELS.forEach((model) => {
    responses.value[model] = { answer: 'Loading...', rating: null }
  })

  const promises = MODELS.map(async (model) => {
    try {
      const result = await $fetch<{ model?: string; answer?: string }>(`/api/query/${model}`, {
        method: 'POST',
        body: { question: questionText.value }
      })

      if (result && result.model) {
        responses.value[result.model] = {
          answer: result.answer || '',
          rating: null
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error && typeof error === 'object' && 'data' in error
          ? String((error as { data?: { message?: string } }).data?.message)
          : error instanceof Error
            ? error.message
            : String(error)
      responses.value[model] = {
        answer: `Error: ${errorMessage}`,
        rating: null
      }
    }
  })

  await Promise.allSettled(promises)

  if (isAuthenticated.value) {
    try {
      const userId = getUserId()
      if (!userId) {
        showError('Unable to save question: User ID not available')
      } else {
        const result = await $fetch<{ id: string }>('/api/questions', {
          method: 'POST',
          body: {
            question: questionText.value,
            responses: responses.value,
            userId
          }
        })

        currentQuestionId.value = result.id

        showSuccess('Question saved successfully! +50 points. View it in "My Questions".')
        questionText.value = ''
        await fetchActivityStats()
      }
    } catch (error: unknown) {
      console.error('Error saving question:', error)
      const msg =
        error && typeof error === 'object' && 'data' in error
          ? (error as { data?: { message?: string } }).data?.message
          : error instanceof Error
            ? error.message
            : 'Unknown error'
      showError(`Failed to save question: ${msg}`)
    }
  } else {
    showError('Question not saved. Please log in to save your questions.')
  }

  loading.value = false
}

const handleRatingUpdate = async ({ model, rating }: { model: string; rating: number | null }) => {
  if (!responses.value || !responses.value[model]) return

  responses.value[model].rating = rating

  if (isAuthenticated.value && currentQuestionId.value) {
    try {
      const userId = getUserId()
      if (userId) {
        const result = await $fetch<{ pointsAwarded?: number }>(
          `/api/questions/${currentQuestionId.value}/ratings`,
          {
            method: 'POST',
            body: {
              userId,
              model,
              rating: rating || 0
            }
          }
        )

        if (result.pointsAwarded && result.pointsAwarded > 0) {
          showSuccess(`+${result.pointsAwarded} points for rating!`)
          await fetchActivityStats()
        }
      }
    } catch (e) {
      console.error('Error saving rating:', e)
    }
  }
}

onMounted(async () => {
  await initAuth()
  authInitialized.value = true

  if (isAuthenticated.value) {
    fetchActivityStats()
  }
})

useHead({
  title: 'Ask — AI Elegance',
  meta: [{ name: 'description', content: 'Compare answers from multiple AI models side by side.' }]
})
</script>
