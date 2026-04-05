<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      Character bios and consistency checks will live here. For now, use placeholders and the legacy vault to browse saved Q&amp;A.
    </p>

    <div
      class="rounded-xl border border-dashed border-gray-300 bg-gray-100 p-8 mb-8 text-center"
    >
      <h2 class="text-lg font-semibold text-gray-800 mb-2">Add your first character</h2>
      <p class="text-sm text-gray-500 mb-6">
        Structured character sheets and arc tracking are planned. This section reads the active project from context only.
      </p>
      <button
        type="button"
        class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors"
        @click="runPlaceholder('Create character')"
      >
        Create character (placeholder)
      </button>
    </div>

    <div class="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <h3 class="text-sm font-medium text-gray-700 mb-2">Legacy reference</h3>
      <p class="text-sm text-gray-500 mb-3">
        Questions vault (unchanged route, not in main nav).
      </p>
      <NuxtLink
        :to="withProjectQuery('/vault')"
        class="text-sm text-primary font-medium hover:underline"
      >
        Open Vault →
      </NuxtLink>
    </div>

    <div class="mt-10 pt-8 border-t border-gray-200">
      <NuxtLink
        :to="`/projects/${projectId}/storyboard`"
        class="text-sm text-primary font-medium hover:underline"
      >
        Next: Storyboard →
      </NuxtLink>
    </div>
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
