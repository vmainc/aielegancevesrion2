<template>
  <div class="max-w-6xl mx-auto px-0 sm:px-4 py-0 sm:py-6 min-h-[calc(100vh-8rem)] sm:min-h-[calc(100vh-10rem)]">
    <ClientOnly>
      <StudioGuideChatPane class="h-[calc(100vh-8rem)] sm:h-[calc(100vh-10rem)]" />
      <template #fallback>
        <div class="rounded-xl border border-primary/20 bg-primary/5 px-4 py-10 h-[calc(100vh-8rem)] sm:h-[calc(100vh-10rem)] flex items-center justify-center">
          <FilmReelLoader
            size="sm"
            label="Loading Home"
            sub-label="Starting Studio Guide…"
          />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import StudioGuideChatPane from '~/components/guide/StudioGuideChatPane.vue'

useHead({ title: 'Home' })
</script>
