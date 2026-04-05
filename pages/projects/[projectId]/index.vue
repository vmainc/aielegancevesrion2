<script setup lang="ts">
const route = useRoute()
const raw = route.params.projectId
const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : ''
if (id) {
  await navigateTo(`/projects/${id}/overview`, { replace: true })
} else {
  await navigateTo('/projects', { replace: true })
}
</script>

<template>
  <div />
</template>
