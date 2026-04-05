<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">Questions Vault</h1>
    
    <div v-if="loading" class="text-gray-600">Loading...</div>
    
    <div v-else-if="questions.length === 0" class="text-gray-600">
      No questions found.
    </div>
    
    <div v-else class="space-y-4">
      <QuestionListCard
        v-for="question in questions"
        :key="question.id"
        :question="question"
      />
    </div>
  </div>
</template>

<script setup>
const questions = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const data = await $fetch('/api/questions')
    questions.value = data.items || []
  } catch (error) {
    console.error('Error fetching questions:', error)
  } finally {
    loading.value = false
  }
})
</script>

