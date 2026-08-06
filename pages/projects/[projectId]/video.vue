<template>
  <div />
</template>

<script setup lang="ts">
/**
 * Video was removed as a workflow tab — generation lives on Storyboard once
 * start + end frames exist. Keep this route as a redirect for old links.
 */
const route = useRoute()
const projectId = String(route.params.projectId || '')
const query: Record<string, string> = {}
const sceneId = firstQueryString(route.query.sceneId)
const shotId = firstQueryString(route.query.shotId)
if (sceneId) query.sceneId = sceneId
if (shotId) query.shotId = shotId

await navigateTo(
  {
    path: `/projects/${projectId}/storyboard`,
    ...(Object.keys(query).length ? { query } : {})
  },
  { replace: true, redirectCode: 302 }
)

function firstQueryString (v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim()
  return ''
}
</script>
