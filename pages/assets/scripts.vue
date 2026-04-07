<template>
  <AssetsAssetKindHub
    kind="script"
    headline="Scripts"
    blurb="Script files and notes tied to your projects. Create a project first, then import from its Overview — the file is stored in your library as a script asset."
    :actions="actions"
    empty-hint="Create a project, then import a .fdx, .txt, or .pdf from that project’s Overview. You can also add a manual library entry below."
  />
</template>

<script setup lang="ts">
const actions = [
  { to: '/projects', label: 'Projects', primary: true },
  { to: '/character-creator', label: 'Character Creator' }
]
</script>
