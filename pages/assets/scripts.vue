<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <nav class="text-sm text-gray-500 mb-6">
      <NuxtLink to="/assets" class="hover:text-primary">Assets</NuxtLink>
      <span class="mx-2" aria-hidden="true">/</span>
      <span class="text-gray-900">Scripts</span>
    </nav>
    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Scripts</h1>
    <p class="text-gray-600 text-sm sm:text-base mb-8">
      Upload and manage script files per project—Final Draft, plain text, PDF imports, and drafts will
      surface here as this area grows.
    </p>
    <div class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <p class="text-gray-700 text-sm mb-4">Script library and uploads are organized inside each project workspace.</p>
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
  title: 'Scripts — Assets',
})
</script>
