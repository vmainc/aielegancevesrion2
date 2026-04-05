<template>
  <div class="border border-gray-200 rounded-lg p-6 bg-white flex flex-col h-full hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10">
    <div class="flex items-start gap-4 mb-4">
      <div class="w-16 h-16 flex items-center justify-center flex-shrink-0 bg-gray-100 rounded-lg p-2">
        <img
          v-if="model.icon"
          :src="model.icon"
          :alt="`${model.name} icon`"
          class="w-full h-full object-contain"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center text-gray-500"
        >
          <svg
            class="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
      </div>
      <div class="flex-1">
        <h3 class="text-xl font-semibold text-gray-900 mb-2">{{ model.name }}</h3>
        <p class="text-gray-400 text-sm leading-relaxed mb-4">{{ model.description }}</p>
      </div>
    </div>

    <div class="mb-4">
      <h4 class="text-sm font-semibold text-gray-300 mb-3">Key Capabilities:</h4>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="capability in model.capabilities"
          :key="capability"
          class="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-md text-xs text-gray-600 hover:border-primary/50 hover:text-primary transition-colors"
        >
          {{ capability }}
        </span>
      </div>
    </div>

    <div class="mt-auto pt-4 border-t border-gray-200 flex items-center justify-between">
      <span class="inline-flex items-center gap-2 text-sm text-primary font-medium">
        <svg
          class="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd"
          />
        </svg>
        {{ model.status }}
      </span>
      <NuxtLink
        to="/"
        class="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
      >
        Learn More →
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
defineProps({
  model: {
    type: Object,
    required: true
  }
})
</script>
