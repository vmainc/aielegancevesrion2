<template>
  <AssetsAssetKindHub
    kind="script"
    headline="Scripts"
    blurb="Script files and notes in your library. Upload in Script Wizard, then optionally attach scripts to projects."
    :actions="actions"
    empty-hint="Upload a .fdx, .txt, or .pdf in Script Wizard to add it here. You can also add a manual script entry below."
  />
</template>

<script setup lang="ts">
const actions = [
  { to: '/tools/script-wizard', label: 'Script Wizard', primary: true },
  { to: '/projects', label: 'Projects' },
  { to: '/character-creator', label: 'Character Creator' }
]
</script>
