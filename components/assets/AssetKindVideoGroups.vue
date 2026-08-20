<template>
  <details
    v-for="g in groups"
    :key="g.key"
    :class="PROJECT_GROUP_CARD_CLASS"
  >
    <summary
      class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-4 py-3 bg-gray-50/90 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-100/80 border-b border-transparent group-open:border-gray-200"
    >
      <div class="flex items-start gap-2 min-w-0 flex-1">
        <span
          class="text-gray-400 text-xs shrink-0 mt-0.5 transition-transform group-open:rotate-90"
          aria-hidden="true"
        >▶</span>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-gray-900 truncate">
            {{ g.title }}
          </h2>
          <p v-if="g.subtitle" class="text-xs text-gray-500 mt-0.5">
            {{ g.subtitle }}
            <span class="text-gray-400"> · {{ g.items.length }} clip{{ g.items.length === 1 ? '' : 's' }}</span>
          </p>
          <p v-else class="text-xs text-gray-500 mt-0.5">
            {{ g.items.length }} clip{{ g.items.length === 1 ? '' : 's' }}
          </p>
        </div>
      </div>
      <NuxtLink
        v-if="g.projectId && PB_ID.test(g.projectId)"
        :to="`/projects/${g.projectId}/storyboard`"
        class="text-xs font-medium text-primary hover:underline shrink-0"
        @click.stop
      >
        Open Storyboard →
      </NuxtLink>
    </summary>
    <div class="divide-y divide-gray-200">
      <details
        v-for="scene in sceneGroupsForProject(g)"
        :key="`${g.key}:${scene.key}`"
        class="group"
      >
        <summary
          class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-4 py-3 bg-studio-slate flex flex-wrap items-center justify-between gap-2 hover:bg-gray-50"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="text-gray-400 text-[10px] shrink-0 transition-transform group-open:rotate-90"
              aria-hidden="true"
            >▶</span>
            <span class="text-sm font-medium text-gray-900 truncate">{{ scene.title }}</span>
            <span class="text-xs text-gray-500">· {{ scene.items.length }} clip{{ scene.items.length === 1 ? '' : 's' }}</span>
          </div>
        </summary>
        <ul class="divide-y divide-gray-100 bg-gray-50/40">
          <li
            v-for="a in scene.items"
            :key="a.id"
            class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
          >
            <div class="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-start gap-3">
              <LazyAssetVideo
                v-if="a.fileUrl"
                :src="videoAssetPlaybackSrc(a)"
              />
              <div class="min-w-0 flex-1">
                <p class="font-medium text-gray-900">{{ a.title }}</p>
                <p v-if="a.notes" class="text-sm text-gray-600 mt-2 line-clamp-3 whitespace-pre-wrap">{{ a.notes }}</p>
                <p class="text-xs text-gray-400 mt-2">{{ formatDate(a.updated || a.created) }}</p>
              </div>
            </div>
            <div class="shrink-0">
              <details class="relative open:z-30">
                <summary
                  class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  Actions
                </summary>
                <div :class="ACTIONS_MENU_PANEL_CLASS">
                  <a
                    v-if="a.fileUrl"
                    :href="videoAssetPlaybackSrc(a)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                  >
                    Download file
                  </a>
                  <NuxtLink
                    v-if="a.projectId"
                    :to="`/projects/${a.projectId}/overview`"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                  >
                    Open project
                  </NuxtLink>
                  <button
                    v-if="a.projectId && moveTargetProjects(a).length"
                    type="button"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                    @click="openMoveVideo(a)"
                  >
                    Move to project…
                  </button>
                  <button
                    type="button"
                    class="block w-full text-left px-3 py-2 rounded-md text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    :disabled="deletingId === a.id"
                    @click="removeAsset(a)"
                  >
                    {{ deletingId === a.id ? 'Removing…' : 'Remove' }}
                  </button>
                </div>
              </details>
            </div>
          </li>
        </ul>
      </details>
    </div>
  </details>
</template>

<script setup lang="ts">
import LazyAssetVideo from '~/components/assets/LazyAssetVideo.vue'
import {
  ACTIONS_MENU_PANEL_CLASS,
  PB_ID,
  PROJECT_GROUP_CARD_CLASS,
  type AssetProjectGroup
} from '~/lib/asset-kind-display'
import type { ProjectAsset } from '~/types/project-asset'
import type { CreativeProject } from '~/types/creative-project'

type AssetSceneGroup = {
  key: string
  title: string
  items: ProjectAsset[]
}

defineProps<{
  groups: AssetProjectGroup[]
  deletingId: string
  sceneGroupsForProject: (group: AssetProjectGroup) => AssetSceneGroup[]
  videoAssetPlaybackSrc: (a: ProjectAsset) => string
  formatDate: (iso: string) => string
  moveTargetProjects: (a: ProjectAsset | null) => CreativeProject[]
  openMoveVideo: (a: ProjectAsset) => void
  removeAsset: (a: ProjectAsset) => void
}>()
</script>
