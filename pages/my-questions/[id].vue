<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div v-if="!questionId" class="text-red-400">Error: No question ID found in route</div>
    <div v-else-if="loading" class="text-gray-600">Loading...</div>
    
    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-400 mb-4">{{ error }}</p>
      <NuxtLink
        to="/my-questions"
        class="inline-block px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
      >
        Back to My Questions
      </NuxtLink>
    </div>
    
    <div v-else-if="question">
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
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{{ question.question }}</h1>
        <p class="text-sm text-gray-500">
          Asked on {{ formatDate(question.created) }}
        </p>
      </div>

      <div v-if="responses && Object.keys(responses).length > 0">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">AI Model Responses</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ModelResponseCard
            v-for="(response, model) in responses"
            :key="model"
            :model="model"
            :response="response"
            @update:rating="handleRatingUpdate"
          />
        </div>
      </div>
      
      <div v-else class="text-center py-12 text-gray-600">
        <p class="mb-4">No responses available for this question.</p>
        <details class="text-left mt-4 p-4 bg-white border border-gray-200 border border-gray-200 rounded">
          <summary class="cursor-pointer text-gray-700 mb-2">Debug Info (click to expand)</summary>
          <pre class="text-xs text-gray-600 overflow-auto">{{ JSON.stringify({ questionId, responses, question }, null, 2) }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Force this to run on client only and log immediately
if (import.meta.client) {
  console.log('🎯🎯🎯 DETAIL PAGE SCRIPT SETUP STARTING (CLIENT) 🎯🎯🎯')
}

const route = useRoute()

definePageMeta({
  middleware: 'auth'
})

const questionId = computed(() => route.params.id as string)

const question = ref(null)
const responses = ref({})
const loading = ref(true)
const error = ref('')

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'No date'
  
  try {
    const date = new Date(dateString)
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }
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

const handleRatingUpdate = async ({ model, rating }) => {
  if (!question.value || !questionId.value) return
  
  try {
    const { getUserId } = useAuth()
    const userId = getUserId()
    
    if (!userId) {
      console.error('User not authenticated')
      return
    }
    
    // Update local state immediately
    if (responses.value[model]) {
      responses.value[model].rating = rating
    }
    
    // Save to database
    const result = await $fetch(`/api/questions/${questionId.value}/rating`, {
      method: 'POST',
      body: {
        userId,
        model,
        rating
      }
    })
    
    // Show points notification if points were awarded
    if (result.pointsAwarded > 0) {
      // Could show a toast notification here
      console.log(`+${result.pointsAwarded} points for rating answer!`)
    }
  } catch (error: any) {
    console.error('Error saving rating:', error)
    // Revert local state on error
    if (responses.value[model]) {
      responses.value[model].rating = question.value.responses?.[model]?.rating || null
    }
  }
}

const fetchQuestion = async (id: string) => {
  try {
    loading.value = true
    error.value = ''
    
    const { getUserId } = useAuth()
    const userId = getUserId()
    
    if (!userId) {
      error.value = 'You must be logged in to view this question'
      loading.value = false
      return
    }

    // Fetch the question via API
    const record = await $fetch(`/api/questions/${id}`)

    // Verify this question belongs to the current user
    const questionUserId = typeof record.user === 'string' ? record.user : record.user?.id || record.user
    if (questionUserId !== userId) {
      error.value = 'You do not have permission to view this question'
      loading.value = false
      return
    }

    question.value = record

    // Parse responses - ensure it's an object
    try {
      let parsedResponses = {}
      
      if (record.responses) {
        if (typeof record.responses === 'string') {
          try {
            parsedResponses = JSON.parse(record.responses || '{}')
          } catch (parseError) {
            console.error('Failed to parse JSON string:', parseError)
            parsedResponses = {}
          }
        } else if (typeof record.responses === 'object' && record.responses !== null) {
          parsedResponses = record.responses
        }
      }
      
      responses.value = parsedResponses
    } catch (e) {
      console.error('❌ Error parsing responses:', e)
      console.error('❌ Raw responses:', record.responses)
      responses.value = {}
    }
  } catch (err: any) {
    console.error('Error fetching question:', err)
    error.value = err?.data?.message || err?.message || 'Failed to load question'
  } finally {
    loading.value = false
  }
}

// Watch for route changes and fetch immediately
watch(() => route.params.id, async (newId) => {
  if (newId) {
    await fetchQuestion(newId as string)
  }
}, { immediate: true })

onMounted(() => {
  const id = route.params.id as string
  if (id) {
    fetchQuestion(id)
  } else {
    error.value = 'No question ID found in URL'
    loading.value = false
  }
})
</script>

