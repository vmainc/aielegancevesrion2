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
            {{ g.projectName }}
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">
            {{ g.items.length }} {{ kind }}{{ g.items.length === 1 ? '' : 's' }}
          </p>
        </div>
      </div>
      <NuxtLink
        v-if="g.projectId && PB_ID.test(g.projectId)"
        :to="projectHubStepTo(g.projectId)"
        class="text-xs font-medium text-primary hover:underline shrink-0"
        @click.stop
      >
        Open project →
      </NuxtLink>
    </summary>
    <ul class="divide-y divide-gray-200">
      <li
        v-for="a in g.items"
        :key="a.id"
        class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 relative hover:z-10 focus-within:z-10"
      >
        <div class="min-w-0 flex-1 flex items-start gap-3">
          <button
            v-if="kind === 'storyboard' && libraryImageSrc(a)"
            type="button"
            class="w-16 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-900 shrink-0 cursor-zoom-in hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
            :aria-label="`View image: ${a.title}`"
            @click="openImagePreview(a)"
          >
            <img
              :src="libraryImageSrc(a)"
              alt=""
              class="w-full h-full object-contain pointer-events-none"
              loading="lazy"
            >
          </button>
          <div class="min-w-0 flex-1">
            <button
              v-if="kind === 'storyboard' && libraryImageSrc(a)"
              type="button"
              class="font-medium text-gray-900 text-left hover:text-primary hover:underline"
              @click="openImagePreview(a)"
            >
              {{ a.title }}
            </button>
            <p v-else class="font-medium text-gray-900">
              {{ a.title }}
            </p>
            <p v-if="scriptSourceLine(a)" class="text-xs font-medium text-primary mt-1">
              {{ scriptSourceLine(a) }}
            </p>
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
              <button
                v-if="kind === 'storyboard' && libraryImageSrc(a)"
                type="button"
                class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
                @click="openImagePreview(a)"
              >
                View image
              </button>
              <button
                v-if="kind === 'script'"
                type="button"
                class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                :disabled="readingScriptId === a.id"
                @click="openScriptReader(a)"
              >
                {{ readingScriptId === a.id ? 'Loading…' : 'Read script' }}
              </button>
              <a
                v-if="libraryImageSrc(a)"
                :href="libraryImageSrc(a)"
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
              <NuxtLink
                v-if="kind === 'storyboard' && a.projectId && PB_ID.test(a.projectId)"
                :to="`/projects/${a.projectId}/storyboard`"
                class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
              >
                Open storyboard
              </NuxtLink>
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
</template>

<script setup lang="ts">
import {
  ACTIONS_MENU_PANEL_CLASS,
  PB_ID,
  PROJECT_GROUP_CARD_CLASS
} from '~/lib/asset-kind-display'
import type { ProjectAssetGroup } from '~/lib/project-asset-sort'
import type { ProjectAsset, ProjectAssetKind } from '~/types/project-asset'

defineProps<{
  groups: ProjectAssetGroup[]
  kind: ProjectAssetKind
  deletingId: string
  readingScriptId: string
  libraryImageSrc: (a: ProjectAsset) => string
  scriptSourceLine: (a: ProjectAsset) => string
  formatDate: (iso: string) => string
  projectHubStepTo: (projectId: string) => string
  openImagePreview: (a: ProjectAsset) => void
  openScriptReader: (a: ProjectAsset) => void
  removeAsset: (a: ProjectAsset) => void
}>()
</script>
