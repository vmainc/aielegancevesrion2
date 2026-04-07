<template>
  <AssetsAssetKindHub
    kind="script"
    headline="Scripts"
    blurb="All screenplay files you save appear here, newest first—whether you upload from a project (Overview → Save screenplay) or from Script Wizard. Each row shows which project it belongs to and a download link when a file is attached."
    :actions="actions"
    empty-hint="Save a .fdx, .txt, or .pdf from Project → Overview (Save screenplay to project) or from Script Wizard. You can also add a manual script entry with “Add script entry” below."
  />
</template>

<script setup lang="ts">
const actions = [
  { to: '/projects', label: 'Projects · save screenplay', primary: true },
  { to: '/tools/script-wizard', label: 'Script Wizard' },
  { to: '/character-creator', label: 'Character Creator' }
]
</script>
