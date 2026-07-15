<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({
  middleware: (to) => navigateTo(`/projects/${String(to.params.projectId || '')}/video`, {
    redirectCode: 302,
    replace: true
  })
})
</script>
