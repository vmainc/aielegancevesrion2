<template>
  <ProductionBiblePanel :project-id="projectId" />
</template>

<script setup lang="ts">
import ProductionBiblePanel from '~/components/project/ProductionBiblePanel.vue'

const { activeProjectId } = useCreativeProject()
const projectId = activeProjectId
</script>
