<template>
  <Teleport to="body">
    <div class="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex flex-col gap-2 max-w-md mx-auto sm:mx-0">
      <TransitionGroup
        name="toast"
        tag="div"
        class="flex flex-col gap-2"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'flex items-center justify-between gap-4 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm w-full max-w-md',
            getToastClasses(toast.type)
          ]"
        >
          <div class="flex items-center gap-3 flex-1">
            <div :class="getIconClasses(toast.type)">
              <svg v-if="toast.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else-if="toast.type === 'error'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <svg v-else-if="toast.type === 'warning'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p :class="getTextClasses(toast.type)" class="flex-1">
              {{ toast.message }}
            </p>
          </div>
          <button
            @click="removeToast(toast.id)"
            :class="getCloseButtonClasses(toast.type)"
            class="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
            aria-label="Close"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { ToastType } from '~/composables/useToast'

const { toasts, removeToast } = useToast()

const getToastClasses = (type: ToastType) => {
  switch (type) {
    case 'success':
      return 'bg-green-500/90 border-green-400/50 text-white'
    case 'error':
      return 'bg-red-500/90 border-red-400/50 text-white'
    case 'warning':
      return 'bg-yellow-500/90 border-yellow-400/50 text-gray-950'
    case 'info':
      return 'bg-blue-500/90 border-blue-400/50 text-white'
    default:
      return 'bg-white border-gray-200 text-gray-900 shadow-md'
  }
}

const getIconClasses = (type: ToastType) => {
  return 'flex-shrink-0'
}

const getTextClasses = (type: ToastType) => {
  switch (type) {
    case 'warning':
      return 'text-gray-950'
    default:
      return 'text-white'
  }
}

const getCloseButtonClasses = (type: ToastType) => {
  switch (type) {
    case 'warning':
      return 'text-gray-700 hover:text-gray-950'
    default:
      return 'text-white/70 hover:text-white'
  }
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>

