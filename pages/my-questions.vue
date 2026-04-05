<template>
  <!-- Detail View (when on detail route) -->
  <div v-if="isDetailRoute" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div v-if="detailLoading" class="text-gray-600">Loading question...</div>
    <div v-else-if="detailError" class="text-center py-12">
      <p class="text-red-400 mb-4">{{ detailError }}</p>
      <NuxtLink
        to="/my-questions"
        class="inline-block px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
      >
        Back to My Questions
      </NuxtLink>
    </div>
    <div v-else-if="detailQuestion">
      <div class="mb-6">
        <NuxtLink
          to="/my-questions"
          class="inline-flex items-center text-gray-600 hover:text-primary transition-colors mb-4"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to My Questions
        </NuxtLink>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{{ detailQuestion.question }}</h1>
        <p class="text-sm text-gray-500">
          Asked on {{ formatDetailDate(detailQuestion.created) }}
        </p>
      </div>

      <div v-if="detailResponses && Object.keys(detailResponses).length > 0">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">AI Model Responses</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ModelResponseCard
            v-for="(response, model) in detailResponses"
            :key="model"
            :model="model"
            :response="response"
          />
        </div>
      </div>
      
      <div v-else class="text-center py-12 text-gray-600">
        <p>No responses available for this question.</p>
      </div>
    </div>
  </div>

  <!-- List View (when on list route) -->
  <div v-else class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">My Questions</h1>
      <button
        v-if="isAuthenticated && !loading"
        @click="fetchQuestions"
        class="px-4 py-2 bg-white border border-gray-200 border border-gray-200 rounded-lg text-gray-700 hover:text-primary hover:border-primary transition-colors whitespace-nowrap"
        title="Refresh questions"
      >
        Refresh
      </button>
    </div>
    
    <div v-if="loading" class="text-gray-600">Loading...</div>
    
    <div v-if="errorMessage" class="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
      <p class="text-red-400 text-sm">{{ errorMessage }}</p>
    </div>
    
    <div v-else-if="!isAuthenticated" class="text-center py-12">
      <p class="text-gray-600 mb-4">Please log in to view your questions</p>
      <NuxtLink
        to="/login"
        class="inline-block px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
      >
        Login
      </NuxtLink>
    </div>
    
    <div v-else-if="questions.length === 0" class="text-center py-12">
      <p class="text-gray-600 mb-4">You haven't asked any questions yet</p>
      <NuxtLink
        to="/"
        class="inline-block px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
      >
        Ask Your First Question
      </NuxtLink>
    </div>
    
    <div v-else class="space-y-4">
      <QuestionListCard
        v-for="question in questions"
        :key="question.id"
        :question="question"
        :link-to-detail="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

// Only render list if we're exactly on /my-questions
const isDetailRoute = computed(() => {
  const path = route.path
  return path !== '/my-questions' && path.startsWith('/my-questions/')
})

const detailQuestionId = computed(() => {
  if (!isDetailRoute.value) return null
  const match = route.path.match(/\/my-questions\/([^/]+)/)
  return match ? match[1] : null
})

definePageMeta({
  middleware: 'auth'
})

const { getUserId, isAuthenticated } = useAuth()
const questions = ref([])
const loading = ref(true)
const errorMessage = ref<string>('')

// Detail view state
const detailQuestion = ref(null)
const detailResponses = ref({})
const detailLoading = ref(false)
const detailError = ref('')

const formatDetailDate = (dateString: string | undefined) => {
  if (!dateString) return 'No date'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid date'
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (e) {
    return 'Invalid date'
  }
}

const fetchDetailQuestion = async (id: string) => {
  try {
    detailLoading.value = true
    detailError.value = ''
    
    const userId = getUserId()
    if (!userId) {
      detailError.value = 'You must be logged in to view this question'
      detailLoading.value = false
      return
    }

    const record = await $fetch(`/api/questions/${id}`)

    const questionUserId = typeof record.user === 'string' ? record.user : record.user?.id || record.user
    if (questionUserId !== userId) {
      detailError.value = 'You do not have permission to view this question'
      detailLoading.value = false
      return
    }

    detailQuestion.value = record

    // Parse responses
    try {
      let parsedResponses = {}
      
      if (record.responses) {
        if (typeof record.responses === 'string') {
          parsedResponses = JSON.parse(record.responses || '{}')
        } else if (typeof record.responses === 'object' && record.responses !== null) {
          parsedResponses = record.responses
        }
      }
      
      detailResponses.value = parsedResponses
    } catch (e) {
      console.error('Error parsing detail responses:', e)
      console.error('Raw responses:', record.responses)
      detailResponses.value = {}
    }
  } catch (err: any) {
    console.error('Error fetching detail question:', err)
    detailError.value = err?.data?.message || err?.message || 'Failed to load question'
  } finally {
    detailLoading.value = false
  }
}

// Watch for detail route changes
watch(() => detailQuestionId.value, (newId) => {
  if (newId) {
    fetchDetailQuestion(newId)
  }
}, { immediate: true })

const fetchQuestions = async () => {
  if (!isAuthenticated.value) {
    loading.value = false
    return
  }

  try {
    loading.value = true
    errorMessage.value = '' // Clear any previous errors
    const userId = getUserId()
    if (userId) {
      const data = await $fetch('/api/questions/my', {
        query: { userId }
      })
      questions.value = data.items || []
    }
  } catch (error: any) {
    console.error('Error fetching questions:', error)
    
    // Extract error message from various possible locations
    let message = 'Failed to load questions'
    if (error?.data?.message) {
      message = error.data.message
    } else if (error?.message) {
      message = error.message
    } else if (typeof error?.data === 'string') {
      message = error.data
    }
    
    errorMessage.value = message
    setTimeout(() => {
      errorMessage.value = ''
    }, 10000)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchQuestions()
})
</script>
