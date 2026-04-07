<template>
  <AssetsAssetKindHub
    kind="storyboard"
    headline="Storyboards"
    blurb="Storyboard panels, exports, and shot-related files saved as library assets per project."
    :actions="actions"
    empty-hint="Add uploads or notes from a project’s storyboard step, or create a library entry here."
  />
</template>

<script setup lang="ts">
const actions = [
  { to: '/projects', label: 'Open projects', primary: true }
]
</script>
