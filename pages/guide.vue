<template>
  <div
    class="max-w-6xl mx-auto px-0 sm:px-4 py-0 sm:py-6"
    :class="isAuthenticated ? 'min-h-[calc(100vh-8rem)] sm:min-h-[calc(100vh-10rem)]' : ''"
  >
    <StudioGuideChatPane class="h-[calc(100vh-8rem)] sm:h-[calc(100vh-10rem)]" />
  </div>
</template>

<script setup lang="ts">
const { isAuthenticated } = useAuth()

useHead({ title: 'Home' })
</script>
