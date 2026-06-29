<template>
  <ProductionBiblePanel :project-id="projectId" />
</template>

<script setup lang="ts">
const { activeProjectId } = useCreativeProject()
const projectId = activeProjectId
</script>
