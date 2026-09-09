<template>
  <div class="min-h-screen bg-studio-charcoal" />
</template>

<script setup lang="ts">
definePageMeta({
  layout: false
})

await navigateTo('/register', { replace: true })
</script>
