<script setup lang="ts">
import { projectOpenLandingPath } from '~/lib/project-workflow'

const route = useRoute()
const raw = route.params.projectId
const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : ''
if (id) {
  await navigateTo(projectOpenLandingPath(id), { replace: true })
} else {
  await navigateTo('/projects', { replace: true })
}
</script>

<template>
  <div />
</template>
