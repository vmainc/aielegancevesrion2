<template>
  <div
    :class="[
      'border border-gray-200 rounded-lg p-6 bg-white hover:border-gray-400 transition-colors shadow-sm',
      linkToDetail ? 'cursor-pointer' : ''
    ]"
    @click="handleClick"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <p class="text-gray-900 mb-2">{{ question.question }}</p>
        <p class="text-sm text-gray-500">
          {{ formatDate(question.created) }}
        </p>
      </div>
      <div class="ml-4 text-sm text-gray-600">
        {{ responseCount }} responses
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
  linkToDetail: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()

const handleClick = async (e: Event) => {
  if (!props.linkToDetail || !props.question?.id) return
  
  e.preventDefault()
  e.stopPropagation()
  
  const path = `/my-questions/${props.question.id}`
  console.log('🖱️ Clicked on question card, navigating to:', path)
  console.log('🔍 Router available:', !!useRouter())
  
  const router = useRouter()
  
  try {
    // Try using router.push with explicit options
    await router.push({
      path: path,
      force: true
    })
    console.log('✅ Router.push successful')
    
    // Force a page reload if needed
    await nextTick()
    console.log('✅ After nextTick')
  } catch (error) {
    console.error('❌ Navigation failed:', error)
    // Fallback: try navigateTo
    try {
      await navigateTo(path, { replace: false, external: false })
      console.log('✅ navigateTo successful')
    } catch (err2) {
      console.error('❌ navigateTo also failed:', err2)
    }
  }
}

const responseCount = computed(() => {
  try {
    const responses = typeof props.question.responses === 'string' 
      ? JSON.parse(props.question.responses || '{}')
      : props.question.responses || {}
    return Object.keys(responses).length
  } catch {
    return 0
  }
})

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
      month: 'short',
      day: 'numeric'
    })
  } catch (e) {
    return 'Invalid date'
  }
}
</script>

