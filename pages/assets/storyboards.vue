<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <nav class="text-sm text-gray-500 mb-6">
      <NuxtLink to="/assets" class="hover:text-primary">Assets</NuxtLink>
      <span class="mx-2" aria-hidden="true">/</span>
      <span class="text-gray-900">Storyboards</span>
    </nav>
    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Storyboards</h1>
    <p class="text-gray-600 text-sm sm:text-base mb-8">
      Storyboard panels, shot lists, and exports from your boards will be available here as uploads and
      generations are wired in.
    </p>
    <div class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <p class="text-gray-700 text-sm mb-4">Open a project to work on the storyboard step.</p>
      <NuxtLink
        to="/projects"
        class="inline-flex px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors text-sm"
      >
        Open Projects
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
useHead({
  title: 'Storyboards — Assets',
})
</script>
