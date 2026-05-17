<template>
  <AssetsAssetKindHub
    kind="video"
    headline="Video"
    blurb="Rendered clips, references, and video-related files stored per project in your asset library."
    :actions="actions"
    empty-hint="Clips generated on a project’s Video step are saved to that project automatically. They also appear here under Assets → Video."
  />
</template>

<script setup lang="ts">
const actions = [
  { to: '/projects', label: 'Open projects', primary: true },
  { to: '/tools/video-generation', label: 'Video tools' }
]
</script>
