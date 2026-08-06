<template>
  <div class="max-w-3xl flex flex-col min-h-[calc(100vh-14rem)]">
    <ProjectGuideChatPane
      v-if="projectId"
      :project-id="projectId"
      class="min-h-[28rem] flex-1"
    />
  </div>
</template>

<script setup lang="ts">
const { activeProjectId } = useCreativeProject()
const projectId = activeProjectId

useHead({ title: 'Guide' })
</script>
