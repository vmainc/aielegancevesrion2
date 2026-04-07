<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">Step 5 of 5</span>
      · Rendering and assembly (structure only for now).
    </p>

    <div class="rounded-xl border border-gray-200 bg-gray-50 p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Video pipeline</h2>
      <p class="text-sm text-gray-600 mb-6">
        Shot and scene renders will enqueue from storyboard frames. Project:
        <span class="text-gray-800 font-medium">{{ project?.name }}</span>
        ({{ project?.aspectRatio }}).
      </p>
      <div class="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          class="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors text-left"
          @click="runPlaceholder('Render Shot')"
        >
          Render Shot
        </button>
        <button
          type="button"
          class="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors text-left"
          @click="runPlaceholder('Render Scene')"
        >
          Render Scene
        </button>
      </div>
    </div>

    <div class="pt-8 border-t border-gray-200">
      <NuxtLink
        to="/tools/script-wizard"
        class="text-sm text-primary font-medium hover:underline"
      >
        Open Script Wizard →
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const { activeProject } = useCreativeProject()
const toast = useToast()

const project = activeProject

function runPlaceholder (label: string) {
  toast.showToast(`${label} is not wired yet — coming soon.`, 'info')
}
</script>
