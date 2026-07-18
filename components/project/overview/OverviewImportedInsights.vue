<script setup lang="ts">
defineProps<{
  threeActBreakdown: string
}>()
</script>

<template>
  <div class="border-t border-gray-100 pt-6 mt-6">
    <h2 class="text-lg font-semibold text-gray-900 mb-2">Three-act breakdown</h2>
    <p class="text-sm text-gray-600 mb-3">
      Structural map from your screenplay as written — not a new version of the story.
    </p>
    <pre
      v-if="threeActBreakdown"
      class="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed rounded-lg border border-gray-200 bg-gray-50 p-4"
    >{{ threeActBreakdown }}</pre>
    <p v-else class="text-sm text-gray-500">
      No act breakdown stored yet. Run director analysis again from Overview after saving your screenplay.
    </p>
  </div>
</template>
