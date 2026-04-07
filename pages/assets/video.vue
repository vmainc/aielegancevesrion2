<template>
  <AssetsAssetKindHub
    kind="video"
    headline="Video"
    blurb="Rendered clips, references, and video-related files stored per project in your asset library."
    :actions="actions"
    empty-hint="Use each project’s Video step for generation; attach exports here as library entries when you add them."
  />
</template>

<script setup lang="ts">
const actions = [
  { to: '/projects', label: 'Open projects', primary: true },
  { to: '/tools/video-generation', label: 'Video tools' }
]
</script>
