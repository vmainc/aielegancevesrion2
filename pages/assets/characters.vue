<template>
  <AssetsAssetKindHub
    kind="character"
    headline="Characters"
    blurb="Character references, sheets, and generated assets stored in your library (kind: character). Use Character Creator or add entries manually per project."
    :actions="actions"
    empty-hint="Generate images in Character Creator, or add a reference entry and link notes here."
  />
</template>

<script setup lang="ts">
const actions = [
  { to: '/character-creator', label: 'Character Creator', primary: true },
  { to: '/projects', label: 'Projects' }
]
</script>
