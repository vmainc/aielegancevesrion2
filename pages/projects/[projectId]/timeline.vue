<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({
  middleware: (to) => navigateTo(`/projects/${String(to.params.projectId || '')}/storyboard`, {
    redirectCode: 302,
    replace: true
  })
})
</script>
