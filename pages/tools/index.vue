<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Tools</h1>
      <p class="text-gray-600 text-sm sm:text-base max-w-2xl">
        Creative utilities powered by AI—character imagery and video generation.
      </p>
    </div>

    <ul class="grid gap-4 sm:grid-cols-2">
      <li v-for="card in cards" :key="card.to">
        <NuxtLink
          :to="card.to"
          class="block rounded-xl border border-gray-200 bg-white shadow-sm hover:border-primary/50 hover:bg-gray-50 transition-all p-6 h-full"
        >
          <h2 class="text-lg font-semibold text-gray-900 mb-2">{{ card.title }}</h2>
          <p class="text-sm text-gray-600 mb-4">{{ card.blurb }}</p>
          <span class="text-sm text-primary font-medium">Open →</span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup>
const cards = [
  {
    to: '/character-creator',
    title: 'Character Creator',
    blurb: 'Generate character portraits and references with image models.',
  },
  {
    to: '/tools/video-generation',
    title: 'Video generation',
    blurb: 'Browse video-capable models on OpenRouter and plan your pipeline.',
  },
]

useHead({
  title: 'Tools',
})
</script>
