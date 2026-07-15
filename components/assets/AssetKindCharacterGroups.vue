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
            <span class="text-gray-400"> · {{ g.items.length }} character{{ g.items.length === 1 ? '' : 's' }}</span>
          </p>
          <p v-else class="text-xs text-gray-500 mt-0.5">
            {{ g.items.length }} character{{ g.items.length === 1 ? '' : 's' }}
          </p>
        </div>
      </div>
      <NuxtLink
        v-if="g.projectId && PB_ID.test(g.projectId)"
        :to="`/projects/${g.projectId}/characters`"
        class="text-xs font-medium text-primary hover:underline shrink-0"
        @click.stop
      >
        Open Characters step →
      </NuxtLink>
    </summary>
    <ul class="divide-y divide-gray-200">
      <li
        v-for="a in g.items"
        :key="a.id"
        class="px-4 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
      >
        <div class="min-w-0 flex-1 flex items-start gap-3">
          <NuxtLink
            v-if="a.fileUrl && characterProfileTo(a)"
            :to="characterProfileTo(a)"
            class="block w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0 hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
            :aria-label="`Open profile: ${a.title}`"
          >
            <img
              :src="characterAssetPlaybackSrc(a)"
              alt=""
              class="w-full h-full object-cover"
              loading="lazy"
            >
          </NuxtLink>
          <button
            v-else-if="a.fileUrl"
            type="button"
            class="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shrink-0 cursor-zoom-in hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
            :aria-label="`View full image: ${a.title}`"
            @click="openImagePreview(a)"
          >
            <img
              :src="characterAssetPlaybackSrc(a)"
              alt=""
              class="w-full h-full object-cover pointer-events-none"
              loading="lazy"
            >
          </button>
          <button
            v-else-if="a.projectId"
            type="button"
            class="w-14 h-14 rounded-lg border border-dashed border-gray-300 bg-gray-50 shrink-0 flex flex-col items-center justify-center text-[10px] leading-tight text-gray-500 hover:border-primary/40 hover:text-primary px-1"
            :disabled="uploadingCharacterAssetId === a.id"
            @click="triggerCharacterImageUpload(a)"
          >
            {{ uploadingCharacterAssetId === a.id ? '…' : 'Add image' }}
          </button>
          <div class="min-w-0 flex-1">
            <NuxtLink
              v-if="characterProfileTo(a)"
              :to="characterProfileTo(a)"
              class="font-medium text-gray-900 hover:text-primary hover:underline"
            >
              {{ a.title }}
            </NuxtLink>
            <p v-else class="font-medium text-gray-900">{{ a.title }}</p>
            <p
              v-if="isFeaturedCharacterAsset(a)"
              class="text-[11px] font-semibold text-emerald-700 mt-0.5"
            >
              Featured image
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
              <NuxtLink
                v-if="characterProfileTo(a)"
                :to="characterProfileTo(a)"
                class="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-primary hover:bg-primary/5"
              >
                View character profile
              </NuxtLink>
              <button
                v-if="a.projectId"
                type="button"
                class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                :disabled="uploadingCharacterAssetId === a.id"
                @click="triggerCharacterImageUpload(a)"
              >
                {{ uploadingCharacterAssetId === a.id ? 'Uploading…' : 'Upload image' }}
              </button>
              <a
                v-if="a.fileUrl"
                :href="a.fileUrl"
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
                :to="characterCreatorTo(a)"
                class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50"
              >
                Open in Character Creator
              </NuxtLink>
              <button
                v-if="a.projectId && a.fileUrl"
                type="button"
                class="block w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                :disabled="featuringId === a.id"
                @click="setFeaturedCharacterImage(a)"
              >
                {{ featuringId === a.id ? 'Setting…' : 'Set as featured' }}
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
</template>

<script setup lang="ts">
import {
  ACTIONS_MENU_PANEL_CLASS,
  PB_ID,
  PROJECT_GROUP_CARD_CLASS,
  isFeaturedCharacterAsset,
  type AssetProjectGroup
} from '~/lib/asset-kind-display'
import type { ProjectAsset } from '~/types/project-asset'

defineProps<{
  groups: AssetProjectGroup[]
  deletingId: string
  featuringId: string
  uploadingCharacterAssetId: string
  characterProfileTo: (a: ProjectAsset) => string
  characterAssetPlaybackSrc: (a: ProjectAsset) => string
  characterCreatorTo: (a: ProjectAsset) => { path: string; query: Record<string, string> }
  scriptSourceLine: (a: ProjectAsset) => string
  formatDate: (iso: string) => string
  openImagePreview: (a: ProjectAsset) => void
  triggerCharacterImageUpload: (a: ProjectAsset) => void
  setFeaturedCharacterImage: (a: ProjectAsset) => void
  removeAsset: (a: ProjectAsset) => void
}>()
</script>
