<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      Theme, arcs, and “smart” passes. Uses the same project context as other sections.
    </p>

    <div class="rounded-xl border border-gray-200 bg-gray-50 p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Analysis actions</h2>
      <div class="flex flex-wrap gap-3 mb-6">
        <button
          type="button"
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors"
          @click="runPlaceholder('Theme analysis')"
        >
          Theme analysis
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors"
          @click="runPlaceholder('Character arc')"
        >
          Character arc
        </button>
      </div>
      <h3 class="text-sm font-medium text-gray-600 mb-2">Legacy tools (direct routes)</h3>
      <ul class="space-y-2 text-sm">
        <li>
          <NuxtLink :to="withProjectQuery('/explore')" class="text-primary hover:underline">
            Explore community questions
          </NuxtLink>
        </li>
        <li>
          <NuxtLink :to="withProjectQuery('/leaderboard')" class="text-primary hover:underline">
            Leaderboard
          </NuxtLink>
        </li>
        <li>
          <NuxtLink :to="withProjectQuery('/meet-the-models')" class="text-primary hover:underline">
            Meet the Models
          </NuxtLink>
        </li>
      </ul>
    </div>

    <NuxtLink
      :to="`/projects/${projectId}/overview`"
      class="text-sm text-gray-600 hover:text-primary transition-colors"
    >
      ← Back to Overview
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
const { activeProjectId, withProjectQuery } = useCreativeProject()
const toast = useToast()

const projectId = activeProjectId

function runPlaceholder (label: string) {
  toast.showToast(`${label} is not wired yet — coming soon.`, 'info')
}
</script>
