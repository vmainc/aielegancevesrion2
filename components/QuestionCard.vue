<template>
  <div class="border border-gray-200 rounded-xl p-6 bg-white hover:border-gray-400 transition-colors shadow-sm">
    <div class="flex items-start justify-between mb-4">
      <div class="flex-1">
        <NuxtLink :to="`/questions/${question.id}`" class="block">
          <h3 class="text-xl font-semibold text-gray-900 mb-2 hover:text-primary transition-colors">
            {{ question.question }}
          </h3>
        </NuxtLink>
        <div class="flex items-center gap-4 text-sm text-gray-500">
          <span>Asked by {{ getUserName(question.expand?.user) }}</span>
          <span>•</span>
          <span>{{ formatDate(question.created) }}</span>
        </div>
      </div>
    </div>

    <!-- AI Ratings Summary -->
    <div v-if="questionRatings && Object.keys(questionRatings).length > 0" class="mb-4">
      <div class="text-sm text-gray-400 mb-2">AI Ratings:</div>
      <div class="flex flex-wrap gap-3">
        <div
          v-for="(rating, model) in questionRatings"
          :key="model"
          class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg"
        >
          <span class="text-xs text-gray-400">{{ model }}:</span>
          <div class="flex items-center gap-1">
            <span class="text-sm font-semibold text-gray-200">{{ rating.average.toFixed(1) }}</span>
            <svg class="w-4 h-4 text-accent-orange" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
            </svg>
            <span class="text-xs text-gray-500">({{ rating.count }})</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="mb-4 text-sm text-gray-500">
      No ratings yet
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-between pt-4 border-t border-gray-200">
      <NuxtLink
        :to="`/questions/${question.id}`"
        class="text-accent-cyan hover:text-accent-cyan/80 transition-colors text-sm font-medium"
      >
        View & Rate →
      </NuxtLink>
      <div class="text-sm text-gray-500">
        {{ getCommentCount(question.id) }} comments
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  question: {
    type: Object,
    required: true
  },
  canRate: {
    type: Boolean,
    default: false
  }
})

const questionRatings = ref({})
const commentCount = ref(0)

const getUserName = (user: any) => {
  if (!user) return 'Unknown'
  return user.name || user.email || 'Unknown'
}

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'Unknown date'
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid date'
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (e) {
    return 'Invalid date'
  }
}

const getCommentCount = (questionId: string) => {
  // This will be fetched from the API
  return commentCount.value
}

onMounted(async () => {
  // Fetch ratings for this question
  try {
    const ratings = await $fetch(`/api/questions/${props.question.id}/ratings`)
    questionRatings.value = ratings
  } catch (error) {
    console.error('Error fetching ratings:', error)
  }

  // Fetch comment count
  try {
    const comments = await $fetch(`/api/questions/${props.question.id}/comments`)
    commentCount.value = comments.items?.length || 0
  } catch (error) {
    console.error('Error fetching comments:', error)
  }
})
</script>

