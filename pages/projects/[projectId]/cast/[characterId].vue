<script setup lang="ts">
import { projectBibleCastPath } from '~/lib/project-bible-paths'

const route = useRoute()

const projectId = computed(() => String(route.params.projectId || ''))
const characterId = computed(() => String(route.params.characterId || ''))
const nameHint = computed(() => {
  const q = route.query.name
  return typeof q === 'string' ? q : Array.isArray(q) ? String(q[0] || '') : ''
})

await navigateTo(
  projectBibleCastPath(projectId.value, characterId.value, nameHint.value),
  { replace: true }
)
</script>

<template>
  <div class="max-w-lg mx-auto px-4 py-16 text-center text-sm text-gray-600">
    Opening character in Production Bible…
  </div>
</template>
