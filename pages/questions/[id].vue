<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div v-if="loading" class="text-gray-600">Loading...</div>
    
    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-400 mb-4">{{ error }}</p>
      <NuxtLink
        to="/explore"
        class="inline-block px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors"
      >
        Back to Explore
      </NuxtLink>
    </div>
    
    <div v-else-if="question">
      <div class="mb-6">
        <NuxtLink
          to="/explore"
          class="inline-flex items-center text-gray-600 hover:text-primary transition-colors mb-4"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Explore
        </NuxtLink>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{{ question.question }}</h1>
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-500">
          <span>Asked by {{ getUserName(question.expand?.user) }}</span>
          <span class="hidden sm:inline">•</span>
          <span>{{ formatDate(question.created) }}</span>
        </div>
      </div>

      <!-- AI Model Responses -->
      <div v-if="responses && Object.keys(responses).length > 0" class="mb-8">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">AI Model Responses</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ModelResponseCard
            v-for="(response, model) in responses"
            :key="model"
            :model="model"
            :response="response"
            :question-id="questionId"
            :can-rate="isAuthenticated"
            :average-rating="modelRatings[model]?.average || 0"
            :rating-count="modelRatings[model]?.count || 0"
            :user-rating="modelRatings[model]?.userRating || null"
            @update:rating="handleRatingUpdate"
          />
        </div>
      </div>
      
      <div v-else class="text-center py-12 text-gray-600 mb-8">
        <p>No responses available for this question.</p>
      </div>

      <!-- Comments Section -->
      <div class="border-t border-gray-200 pt-8">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Comments</h2>
        
        <!-- Add Comment Form -->
        <div v-if="isAuthenticated" class="mb-6">
          <textarea
            v-model="newComment"
            placeholder="Add a comment..."
            rows="3"
            class="w-full px-4 py-3 bg-white border border-gray-200 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-primary transition-colors mb-3"
          />
          <button
            @click="submitComment"
            :disabled="!newComment.trim() || submittingComment"
            class="px-6 py-2 bg-accent-cyan hover:bg-accent-cyan/90 text-gray-950 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ submittingComment ? 'Posting...' : 'Post Comment' }}
          </button>
        </div>
        
        <div v-else class="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
          <p class="text-sm text-yellow-400">
            <NuxtLink to="/login" class="underline hover:text-yellow-300">Log in</NuxtLink> to comment
          </p>
        </div>

        <!-- Comments List -->
        <div v-if="loadingComments" class="text-gray-600">Loading comments...</div>
        
        <div v-else-if="comments.length === 0" class="text-center py-8 text-gray-600">
          <p>No comments yet. Be the first to comment!</p>
        </div>
        
        <div v-else class="space-y-4">
          <div
            v-for="comment in comments"
            :key="comment.id"
            class="border border-gray-200 rounded-lg p-4 bg-white border border-gray-200"
          >
            <div class="flex items-start gap-4">
              <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-gray-200">
                <img
                  v-if="comment.expand?.user?.avatar"
                  :src="getAvatarUrl(comment.expand?.user)"
                  :alt="getUserName(comment.expand?.user)"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full bg-gradient-to-br from-accent-cyan to-accent-orange flex items-center justify-center"
                >
                  <span class="text-gray-950 font-bold text-sm">
                    {{ (comment.expand?.user?.name || comment.expand?.user?.email || '?')[0].toUpperCase() }}
                  </span>
                </div>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <span class="font-semibold text-gray-800">
                    {{ getUserName(comment.expand?.user) }}
                  </span>
                  <span class="text-xs text-gray-500">
                    {{ formatDate(comment.created) }}
                  </span>
                </div>
                <p class="text-gray-700 whitespace-pre-wrap">{{ comment.comment }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { isAuthenticated, getUserId } = useAuth()
const { success: showSuccess, error: showError } = useToast()

const questionId = computed(() => route.params.id as string)

const question = ref(null)
const responses = ref({})
const modelRatings = ref({})
const comments = ref([])
const loading = ref(true)
const loadingComments = ref(false)
const error = ref('')
const newComment = ref('')
const submittingComment = ref(false)

const getUserName = (user: any) => {
  if (!user) return 'Unknown'
  return user.name || user.email || 'Unknown'
}

const getAvatarUrl = (user: any) => {
  if (!user || !user.avatar) return null
  try {
    const pb = useAuth().getPocketBase()
    return pb.files.getURL(user, user.avatar)
  } catch (error) {
    console.error('Error getting avatar URL:', error)
    return null
  }
}

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'No date'
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid date'
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (e) {
    return 'Invalid date'
  }
}

const fetchQuestion = async (id: string) => {
  try {
    loading.value = true
    error.value = ''

    const record = await $fetch(`/api/questions/${id}`)
    question.value = record

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
      
      responses.value = parsedResponses
    } catch (e) {
      console.error('Error parsing responses:', e)
      responses.value = {}
    }

    // Fetch ratings for this question
    await fetchRatings(id)
    
    // Fetch comments
    await fetchComments(id)
  } catch (err: any) {
    console.error('Error fetching question:', err)
    error.value = err?.data?.message || err?.message || 'Failed to load question'
  } finally {
    loading.value = false
  }
}

const fetchRatings = async (id: string) => {
  try {
    const userId = getUserId()
    const query: any = {}
    if (userId) {
      query.userId = userId
    }
    
    const ratings = await $fetch(`/api/questions/${id}/ratings`, {
      query
    })
    
    modelRatings.value = ratings
  } catch (error) {
    console.error('Error fetching ratings:', error)
  }
}

const fetchComments = async (id: string) => {
  try {
    loadingComments.value = true
    const data = await $fetch(`/api/questions/${id}/comments`)
    comments.value = data.items || []
  } catch (error) {
    console.error('Error fetching comments:', error)
  } finally {
    loadingComments.value = false
  }
}

const handleRatingUpdate = async ({ model, rating }) => {
  if (!isAuthenticated.value || !questionId.value) {
    showError('Please log in to rate answers')
    return
  }

  try {
    const userId = getUserId()
    if (!userId) return

    const result = await $fetch(`/api/questions/${questionId.value}/ratings`, {
      method: 'POST',
      body: {
        userId,
        model,
        rating: rating || 0
      }
    })

    // Refresh ratings
    await fetchRatings(questionId.value)

    if (result.pointsAwarded > 0) {
      showSuccess(`+${result.pointsAwarded} points for rating!`)
    }
  } catch (err: any) {
    console.error('Error saving rating:', err)
    showError(err?.data?.message || 'Failed to save rating')
  }
}

const submitComment = async () => {
  if (!isAuthenticated.value || !newComment.value.trim()) return

  try {
    submittingComment.value = true
    const userId = getUserId()
    
    if (!userId) {
      showError('You must be logged in to comment')
      return
    }

    const result = await $fetch(`/api/questions/${questionId.value}/comments`, {
      method: 'POST',
      body: {
        userId,
        comment: newComment.value.trim()
      }
    })

    newComment.value = ''
    
    // Refresh comments
    await fetchComments(questionId.value)

    if (result.pointsAwarded > 0) {
      showSuccess(`Comment posted! +${result.pointsAwarded} points`)
    }
  } catch (err: any) {
    console.error('Error posting comment:', err)
    showError(err?.data?.message || 'Failed to post comment')
  } finally {
    submittingComment.value = false
  }
}

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

