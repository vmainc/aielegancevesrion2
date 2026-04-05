<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header with gradient -->
    <div class="mb-8 bg-gradient-to-r from-accent-cyan via-primary to-accent-orange rounded-xl p-8">
      <h1 class="text-4xl font-bold text-gray-950 mb-2">Community Leaderboard</h1>
      <p class="text-gray-900/80">Compete with the community and climb the ranks!</p>
    </div>

    <!-- Points Info Section -->
    <div class="mb-8 bg-white border border-gray-200 border border-gray-200 rounded-xl p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">How to Earn Points</h2>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div class="flex flex-col items-center text-center">
          <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-2">
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p class="text-sm font-medium text-gray-700">Post Question</p>
          <p class="text-xs text-accent-cyan">50 pts</p>
        </div>
        
        <div class="flex flex-col items-center text-center">
          <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-2">
            <svg class="w-6 h-6 text-accent-orange" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
            </svg>
          </div>
          <p class="text-sm font-medium text-gray-700">Rate Answer</p>
          <p class="text-xs text-accent-cyan">10 pts</p>
        </div>
        
        <div class="flex flex-col items-center text-center">
          <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-2">
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p class="text-sm font-medium text-gray-700">Comment</p>
          <p class="text-xs text-accent-cyan">15 pts</p>
        </div>
        
        <div class="flex flex-col items-center text-center">
          <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-2">
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="absolute mt-8 text-xs font-bold text-gray-900">17</span>
          </div>
          <p class="text-sm font-medium text-gray-700">Daily Login</p>
          <p class="text-xs text-accent-cyan">5 pts</p>
        </div>
        
        <div class="flex flex-col items-center text-center">
          <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-2">
            <svg class="w-6 h-6 text-accent-orange" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
            </svg>
          </div>
          <p class="text-sm font-medium text-gray-700">Weekly Streak</p>
          <p class="text-xs text-accent-cyan">25 pts</p>
        </div>
      </div>
    </div>
    
    <!-- Leaderboard -->
    <div class="border border-gray-200 rounded-lg bg-white border border-gray-200 overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-gray-600">
        Loading...
      </div>
      
      <div v-else-if="leaderboard.length === 0" class="p-8 text-center text-gray-600">
        No users found.
      </div>
      
      <div v-else>
        <LeaderboardRow
          v-for="(entry, index) in leaderboard"
          :key="entry.id"
          :rank="index + 1"
          :user="entry.expand?.user || null"
          :points="entry.points"
          :is-current-user="isCurrentUser(entry.expand?.user)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user } = useAuth()
const leaderboard = ref([])
const loading = ref(true)

const isCurrentUser = (entryUser: any) => {
  if (!user.value || !entryUser) return false
  return user.value.id === entryUser.id
}

onMounted(async () => {
  try {
    const data = await $fetch('/api/leaderboard')
    leaderboard.value = data.items || []
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
  } finally {
    loading.value = false
  }
})
</script>

