<template>
  <ProjectWorkspaceLayout
    :project="project"
    :project-id="projectId"
    :loading="!clientReady"
  >
    <!-- Remount child routes when switching projects so page refs/watchers cannot use a stale project id. -->
    <NuxtPage :key="projectId" />
  </ProjectWorkspaceLayout>
</template>

<script setup lang="ts">
const route = useRoute()
const { getById, clientReady, registerImportedProject } = useCreativeProject()
const { getAuthToken } = useAuth()

const projectId = computed(() => {
  const p = route.params.projectId
  return typeof p === 'string' ? p : Array.isArray(p) ? p[0] ?? '' : ''
})

const project = computed(() => {
  const id = projectId.value
  if (!id) return null
  return getById(id)
})

/** PocketBase record ids are 15 chars [a-z0-9] — fetch project if missing from client state (deep link / refresh). */
const looksLikePbId = (id: string) => /^[a-z0-9]{15}$/.test(id)

function isAbortLike (e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as { name?: string; cause?: unknown }
  if (o.name === 'AbortError') return true
  const c = o.cause
  return typeof c === 'object' && c !== null && 'name' in c && (c as { name?: string }).name === 'AbortError'
}

/** Cancel in-flight hydrate when switching projects so the console does not show 404 for the previous id. */
let hydrateAbort: AbortController | null = null

onBeforeUnmount(() => {
  hydrateAbort?.abort()
  hydrateAbort = null
})

watch(projectId, () => {
  hydrateAbort?.abort()
  hydrateAbort = null
})

watch(
  [clientReady, projectId, project],
  async () => {
    if (!import.meta.client || !clientReady.value) return
    const id = projectId.value
    if (!id || project.value) return
    if (!looksLikePbId(id)) return
    const token = getAuthToken()
    if (!token) return

    hydrateAbort?.abort()
    hydrateAbort = new AbortController()
    const { signal } = hydrateAbort

    try {
      const res = await $fetch<{ project: import('~/types/creative-project').CreativeProject }>(
        `/api/projects/${id}`,
        { headers: { Authorization: `Bearer ${token}` }, signal }
      )
      // Ignore if user navigated to another project while this request was in flight.
      if (projectId.value !== id) return
      registerImportedProject(res.project)
    } catch (e: unknown) {
      if (signal.aborted || isAbortLike(e)) return
      /* not found or forbidden — layout shows missing project */
    }
  },
  { immediate: true }
)
</script>
