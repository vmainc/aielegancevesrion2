<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-6 sm:mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Explore Questions</h1>
      <p class="text-sm sm:text-base text-gray-600">Browse and interact with questions from the community</p>
    </div>

    <!-- Search and Filters -->
    <div class="mb-6 space-y-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search questions..."
        class="w-full px-4 py-3 bg-white border border-gray-200 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
      />
      
      <!-- Filter Options - Always visible -->
      <div class="flex flex-wrap gap-3 items-center">
        <span class="text-sm text-gray-600 whitespace-nowrap">Sort by:</span>
        <button
          @click="sortBy = 'newest'"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
            sortBy === 'newest'
              ? 'bg-primary text-gray-950'
              : 'bg-white border border-gray-200 border border-gray-200 text-gray-700 hover:border-primary hover:text-gray-900'
          ]"
        >
          Newest First
        </button>
        <button
          @click="sortBy = 'oldest'"
          :class="[
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
            sortBy === 'oldest'
              ? 'bg-primary text-gray-950'
              : 'bg-white border border-gray-200 border border-gray-200 text-gray-700 hover:border-primary hover:text-gray-900'
          ]"
        >
          Oldest First
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-gray-600">Loading...</div>

    <div v-else-if="filteredQuestions.length === 0" class="text-center py-12 text-gray-600">
      <p>No questions found.</p>
    </div>

    <div v-else class="space-y-4">
      <QuestionCard
        v-for="question in filteredQuestions"
        :key="question.id"
        :question="question"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const questions = ref([])
const loading = ref(true)
const searchQuery = ref('')
const sortBy = ref<'newest' | 'oldest'>('newest')

const filteredQuestions = computed(() => {
  let result = [...questions.value] // Create a copy to avoid mutating the original
  
  // Apply search filter if there's a query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((q: any) => {
      return q.question?.toLowerCase().includes(query) ||
             q.expand?.user?.email?.toLowerCase().includes(query) ||
             q.expand?.user?.name?.toLowerCase().includes(query)
    })
  }
  
  // Sort based on selected option
  const sorted = result.sort((a: any, b: any) => {
    // Get created timestamp - PocketBase uses 'created' field (ISO 8601 string)
    // Handle both string and Date formats, with fallback to ID if created is missing
    let dateA: number | null = null
    let dateB: number | null = null
    
    if (a.created) {
      try {
        const parsed = new Date(a.created).getTime()
        if (!isNaN(parsed)) dateA = parsed
      } catch (e) {
        console.warn('Invalid date A:', a.created)
      }
    }
    
    if (b.created) {
      try {
        const parsed = new Date(b.created).getTime()
        if (!isNaN(parsed)) dateB = parsed
      } catch (e) {
        console.warn('Invalid date B:', b.created)
      }
    }
    
    // If both have dates, sort by date
    if (dateA !== null && dateB !== null) {
      if (sortBy.value === 'newest') {
        return dateB - dateA // Descending order (newest first)
      } else {
        return dateA - dateB // Ascending order (oldest first)
      }
    }
    
    // If one has a date and one doesn't, prioritize the one with a date
    if (dateA !== null && dateB === null) {
      return sortBy.value === 'newest' ? -1 : 1 // Item with date comes first for newest, last for oldest
    }
    if (dateA === null && dateB !== null) {
      return sortBy.value === 'newest' ? 1 : -1 // Item with date comes first for newest, last for oldest
    }
    
    // Fallback to ID comparison if both dates are missing
    // Reverse string comparison for newest-first approximation
    if (sortBy.value === 'newest') {
      return b.id.localeCompare(a.id)
    } else {
      return a.id.localeCompare(b.id)
    }
  })
  
  return sorted
})

onMounted(async () => {
  try {
    const data = await $fetch('/api/questions')
    console.log('Fetched questions data:', data)
    questions.value = data.items || []
    console.log('Questions array length:', questions.value.length)
    
    // Log all questions with their created dates for debugging
    const questionsWithoutCreated = questions.value.filter((q: any) => !q.created)
    if (questionsWithoutCreated.length > 0) {
      console.warn('⚠️ Found questions without created field:', questionsWithoutCreated.length, questionsWithoutCreated.map((q: any) => q.id))
    }
    
    questions.value.slice(0, 5).forEach((q: any, index: number) => {
      console.log(`Question ${index + 1}:`, {
        id: q.id,
        question: q.question?.substring(0, 50),
        created: q.created,
        createdType: typeof q.created,
        hasCreated: !!q.created
      })
    })
    
    // Verify sorting after setting questions
    console.log('First question after fetch:', questions.value[0]?.id, 'created:', questions.value[0]?.created)
    console.log('Last question after fetch:', questions.value[questions.value.length - 1]?.id, 'created:', questions.value[questions.value.length - 1]?.created)
  } catch (error) {
    console.error('Error fetching questions:', error)
  } finally {
    loading.value = false
  }
})
</script>

