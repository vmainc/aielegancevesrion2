<template>
  <AssetsAssetKindHub
    kind="video"
    headline="Video"
    blurb="Rendered clips, references, and video-related files stored per project in your asset library."
    :actions="actions"
    empty-hint="Generate video from a project’s Video step or from Tools → Video generation (pick a project to save). Clips are grouped by project below."
  />
</template>

<script setup lang="ts">
const actions = [
  { to: '/projects', label: 'Open projects', primary: true },
  { to: '/tools/video-generation', label: 'Video tools' },
  { to: '/tools/fix-shot', label: 'Fix Shot' }
]
</script>
