<template>
  <div class="max-w-[1600px]">
    <div class="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <p class="text-sm text-gray-500 mb-1">
          <span class="text-primary font-medium">{{ stepBadge || 'Timeline' }}</span>
          · AI film assembly
        </p>
        <h1 class="text-lg font-semibold text-gray-900">
          Timeline editor
        </h1>
        <p class="text-sm text-gray-600 mt-1 max-w-2xl">
          Arrange, trim, and split AI clips on a cinematic timeline. Add clips from
          <NuxtLink :to="`/projects/${projectId}/video`" class="text-primary font-medium hover:underline">Video</NuxtLink>.
          Removing a clip here only edits the timeline — nothing is deleted from
          <NuxtLink to="/assets/video" class="text-primary font-medium hover:underline">Assets → Video</NuxtLink>.
        </p>
      </div>
      <NuxtLink
        :to="`/projects/${projectId}/video`"
        class="text-sm font-medium text-primary hover:underline shrink-0"
      >
        ← Back to Video
      </NuxtLink>
    </div>

    <CloudProjectRequired
      feature-label="The timeline editor"
      loading-label="Loading timeline"
      loading-sub-label="Preparing project workspace…"
    >
      <div
        class="rounded-2xl border border-gray-800 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 p-4 sm:p-6 shadow-xl"
      >
        <EditorTimelineEditor
          v-if="projectId"
          :project-id="projectId"
        />
      </div>
    </CloudProjectRequired>
  </div>
</template>

<script setup lang="ts">
const { activeProjectId } = useCreativeProject()
const { stepBadge } = useProjectWorkflowStep()

const projectId = activeProjectId
</script>
