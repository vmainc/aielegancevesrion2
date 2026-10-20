<template>
  <div class="max-w-4xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">{{ stepBadge || 'Step —' }}</span>
      · Generated videos for this project. Drag to reorder; Edit reopens the prompt to regenerate; Delete removes a clip.
    </p>

    <div
      v-if="!activeProject"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Open a project from the workflow to use this step.
    </div>

    <template v-else-if="!canLoadCloud">
      <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 mb-6">
        Generated videos are available for account projects. Sign in and open a cloud project.
      </div>
    </template>

    <template v-else>
      <div class="rounded-xl border border-gray-200 bg-studio-slate p-4 sm:p-5 mb-6">
        <ProjectGeneratedVideosPanel :project-id="projectId" />
      </div>
      <div class="flex flex-wrap gap-3">
        <NuxtLink
          :to="`/tools/video-generation?projectId=${projectId}`"
          class="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-gray-950 hover:bg-primary/90"
        >
          Generate video
        </NuxtLink>
        <NuxtLink
          :to="`/projects/${projectId}/storyboard`"
          class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
        >
          Open storyboard
        </NuxtLink>
        <NuxtLink
          to="/assets/video"
          class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
        >
          All video assets
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { workflowStepOf } from '~/lib/project-workflow'

const PB_ID = /^[a-z0-9]{15}$/

const { activeProject, activeProjectId } = useCreativeProject()
const { isAuthenticated } = useAuth()

const projectId = computed(() => activeProjectId.value || '')
const canLoadCloud = computed(() =>
  Boolean(projectId.value && PB_ID.test(projectId.value) && isAuthenticated.value)
)

const stepBadge = computed(() => {
  const step = workflowStepOf('video', activeProject.value)
  if (!step) return ''
  return `Step ${step.current} of ${step.total}`
})
</script>
