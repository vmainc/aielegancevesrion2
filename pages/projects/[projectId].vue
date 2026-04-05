<template>
  <ProjectWorkspaceLayout
    :project="project"
    :project-id="projectId"
    :loading="!clientReady"
  >
    <NuxtPage />
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

watch(
  [clientReady, projectId, project],
  async () => {
    if (!import.meta.client || !clientReady.value) return
    const id = projectId.value
    if (!id || project.value) return
    if (!looksLikePbId(id)) return
    const token = getAuthToken()
    if (!token) return
    try {
      const res = await $fetch<{ project: import('~/types/creative-project').CreativeProject }>(
        `/api/projects/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      registerImportedProject(res.project)
    } catch {
      /* not found or forbidden — layout shows missing project */
    }
  },
  { immediate: true }
)
</script>
