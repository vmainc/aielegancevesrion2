<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <nav class="text-sm text-gray-500 mb-6">
      <NuxtLink to="/assets" class="hover:text-primary">Assets</NuxtLink>
      <span class="mx-2" aria-hidden="true">/</span>
      <span class="text-gray-900">Characters</span>
    </nav>
    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Characters</h1>
    <p class="text-gray-600 text-sm sm:text-base mb-8">
      Character assets—generated images, references, and sheets—will be collected here alongside your
      project character workflow.
    </p>
    <div class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <p class="text-gray-700 text-sm mb-4">Use Character Creator for new images; project characters live under each project.</p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <NuxtLink
          to="/character-creator"
          class="inline-flex justify-center px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg transition-colors text-sm"
        >
          Character Creator
        </NuxtLink>
        <NuxtLink
          to="/projects"
          class="inline-flex justify-center px-5 py-2.5 border border-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-100 transition-colors text-sm"
        >
          Projects
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
useHead({
  title: 'Characters — Assets',
})
</script>
