<template>
  <div class="max-w-3xl flex flex-col min-h-[calc(100vh-14rem)]">
    <ClientOnly>
      <ProjectGuideChatPane
        v-if="projectId"
        :project-id="projectId"
        class="min-h-[28rem] flex-1"
      />
      <template #fallback>
        <div class="rounded-xl border border-primary/20 bg-primary/5 px-4 py-10 min-h-[28rem] flex items-center justify-center">
          <FilmReelLoader
            size="sm"
            label="Loading Guide"
            sub-label="Opening project Guide…"
          />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const { activeProjectId } = useCreativeProject()
const projectId = activeProjectId

useHead({ title: 'Guide' })
</script>
