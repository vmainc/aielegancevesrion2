<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">Step 3 of 5</span>
      · Script, treatment, and writing — separate from the Director bible tab.
    </p>

    <div>
      <h2 class="text-lg font-semibold text-gray-900 mb-3">Treatment & synopsis</h2>
      <p class="text-sm text-gray-500 mb-4">
        Draft longer-form text in Overview notes for now.
      </p>
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors"
          @click="runPlaceholder('Generate Script')"
        >
          Generate Script
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors"
          @click="runPlaceholder('Generate Treatment')"
        >
          Generate Treatment
        </button>
      </div>
    </div>

    <div class="mt-10 pt-8 border-t border-gray-200 flex flex-wrap gap-4">
      <NuxtLink
        :to="`/projects/${projectId}/director`"
        class="text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        ← Director
      </NuxtLink>
      <NuxtLink
        :to="`/projects/${projectId}/characters`"
        class="text-sm text-primary font-medium hover:underline"
      >
        Next: Characters →
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const { activeProjectId } = useCreativeProject()
const toast = useToast()

const projectId = activeProjectId

function runPlaceholder (label: string) {
  toast.showToast(`${label} is not wired yet — coming soon.`, 'info')
}
</script>
