<template>
  <div :class="[
    'flex items-center justify-between p-4 border-b border-gray-200 transition-colors',
    isCurrentUser ? 'bg-accent-cyan/10 border-accent-cyan/30' : ''
  ]">
    <div class="flex items-center space-x-4 flex-1">
      <!-- Rank Badge -->
      <div class="relative w-12 h-12 flex-shrink-0">
        <div v-if="rank === 1" class="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center relative">
          <svg class="w-7 h-7 text-yellow-900" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span class="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white">1</span>
        </div>
        <div v-else-if="rank === 2" class="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center relative">
          <svg class="w-7 h-7 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span class="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white">2</span>
        </div>
        <div v-else-if="rank === 3" class="w-12 h-12 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center relative">
          <svg class="w-7 h-7 text-amber-900" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span class="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white">3</span>
        </div>
        <div v-else class="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 font-bold text-lg">
          #{{ rank }}
        </div>
      </div>

      <!-- Avatar -->
      <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-gray-200">
        <img
          v-if="user?.avatar"
          :src="avatarUrl"
          :alt="user?.name || user?.email"
          class="w-full h-full object-cover"
        />
        <div
          v-else
          class="w-full h-full bg-gradient-to-br from-accent-cyan to-accent-orange flex items-center justify-center text-gray-950 font-bold text-lg"
        >
          {{ (user?.name || user?.email || '?')[0].toUpperCase() }}
        </div>
      </div>

      <!-- User Info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="text-gray-900 font-medium truncate">{{ user?.name || user?.email || `User ${user?.id}` }}</p>
          <span v-if="isCurrentUser" class="text-xs font-semibold text-accent-cyan bg-accent-cyan/20 px-2 py-0.5 rounded">YOU</span>
        </div>
        <p v-if="user?.email && user?.name" class="text-xs text-gray-500 truncate">{{ user.email }}</p>
      </div>
    </div>
    
    <!-- Points -->
    <div class="text-lg font-bold text-gray-900 flex-shrink-0 ml-4">
      {{ points.toLocaleString() }} POINTS
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  rank: {
    type: Number,
    required: true
  },
  user: {
    type: Object,
    default: null
  },
  points: {
    type: Number,
    required: true
  },
  isCurrentUser: {
    type: Boolean,
    default: false
  }
})

const { getPocketBase } = useAuth()

const avatarUrl = computed(() => {
  if (!props.user?.avatar) return null
  const pb = getPocketBase()
  return pb.files.getURL(props.user, props.user.avatar)
})
</script>

