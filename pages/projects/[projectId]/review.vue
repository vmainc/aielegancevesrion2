<template>
  <div class="max-w-5xl">
    <div class="mb-5">
      <p class="text-sm text-gray-500 mb-1">
        <span class="text-primary font-medium">Review Dashboard</span>
        · Project attention summary
      </p>
      <h1 class="text-lg font-semibold text-gray-900">
        What needs attention
      </h1>
      <p class="text-sm text-gray-600 mt-1 max-w-2xl">
        Read-only counts across Production Bible, timeline, assets, and generation.
        Open linked tools to review or fix items.
      </p>
    </div>

    <CloudProjectRequired
      feature-label="The review dashboard"
      loading-label="Loading review dashboard"
      loading-sub-label="Preparing project workspace…"
    >
      <div v-if="loadError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4">
        {{ loadError }}
      </div>

      <div
        v-if="loading"
        class="rounded-xl border border-primary/20 bg-primary/5 p-8"
      >
        <FilmReelLoader size="sm" label="Loading review counts" sub-label="Fetching bible, timeline, and assets…" />
      </div>

      <template v-else-if="counts">
        <div class="grid gap-4 sm:grid-cols-2 mb-6">
          <section class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 class="text-sm font-semibold text-gray-900 mb-3">Production Bible</h2>
            <ul class="space-y-2 text-sm">
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Facts pending review</span>
                <CountBadge :value="counts.bible.factsPendingReview" :warn="counts.bible.factsPendingReview > 0" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Tentative entities</span>
                <CountBadge :value="counts.bible.tentativeEntities" :warn="counts.bible.tentativeEntities > 0" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Tentative relationships</span>
                <CountBadge :value="counts.bible.tentativeRelationships" :warn="counts.bible.tentativeRelationships > 0" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Retired / contradicted</span>
                <CountBadge :value="counts.bible.retiredOrContradicted" />
              </li>
            </ul>
            <div class="mt-4 flex flex-wrap gap-2">
              <NuxtLink :to="biblePath" class="text-xs font-medium text-primary hover:underline">
                Open Production Bible
              </NuxtLink>
              <NuxtLink
                v-if="counts.bible.factsPendingReview > 0"
                :to="biblePath"
                class="text-xs font-medium text-amber-800 hover:underline"
              >
                Review facts
              </NuxtLink>
              <NuxtLink
                v-if="counts.bible.tentativeEntities + counts.bible.tentativeRelationships > 0"
                :to="biblePath"
                class="text-xs font-medium text-amber-800 hover:underline"
              >
                Review tentative items
              </NuxtLink>
            </div>
          </section>

          <section class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 class="text-sm font-semibold text-gray-900 mb-3">Timeline</h2>
            <ul class="space-y-2 text-sm">
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Cloud timeline</span>
                <CountBadge :label="counts.timeline.cloudTimelineExists ? 'Yes' : 'No'" :warn="!counts.timeline.cloudTimelineExists" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Local-only backup</span>
                <CountBadge :label="counts.timeline.localOnly ? 'Yes' : 'No'" :warn="counts.timeline.localOnly" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Queued cloud save</span>
                <CountBadge :value="counts.timeline.queuedCloudSave ? 1 : 0" :warn="counts.timeline.queuedCloudSave" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Missing media clips</span>
                <CountBadge :value="counts.timeline.missingMedia" :warn="counts.timeline.missingMedia > 0" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Local blob clips</span>
                <CountBadge :value="counts.timeline.localBlob" :warn="counts.timeline.localBlob > 0" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Recoverable clips</span>
                <CountBadge :value="counts.timeline.recoverable" :warn="counts.timeline.recoverable > 0" />
              </li>
            </ul>
            <div class="mt-4">
              <NuxtLink :to="timelinePath" class="text-xs font-medium text-primary hover:underline">
                Open timeline
              </NuxtLink>
            </div>
          </section>

          <section class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 class="text-sm font-semibold text-gray-900 mb-3">Assets</h2>
            <ul class="space-y-2 text-sm">
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">With generation observability</span>
                <CountBadge :value="counts.assets.withObservability" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Generated, no observability</span>
                <CountBadge :value="counts.assets.withoutObservability" :warn="counts.assets.withoutObservability > 0" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Legacy prompt metadata</span>
                <CountBadge :value="counts.assets.legacyPromptMetadata" :warn="counts.assets.legacyPromptMetadata > 0" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Linked to Bible entities</span>
                <CountBadge :value="counts.assets.linkedToBibleEntities" />
              </li>
            </ul>
            <div class="mt-4 flex flex-wrap gap-2">
              <NuxtLink :to="assetsPath" class="text-xs font-medium text-primary hover:underline">
                Open Assets
              </NuxtLink>
              <NuxtLink
                v-if="counts.assets.legacyPromptMetadata > 0"
                :to="biblePath"
                class="text-xs font-medium text-amber-800 hover:underline"
              >
                Redact legacy prompt metadata
              </NuxtLink>
            </div>
          </section>

          <section class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 class="text-sm font-semibold text-gray-900 mb-3">Generation</h2>
            <ul class="space-y-2 text-sm">
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Recent generated assets ({{ RECENT_GENERATED_ASSET_DAYS }}d)</span>
                <CountBadge :value="counts.generation.recentGeneratedAssets" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">Bible context used</span>
                <CountBadge :value="counts.generation.bibleContextUsed" />
              </li>
              <li class="flex items-center justify-between gap-3">
                <span class="text-gray-700">No Bible context</span>
                <CountBadge :value="counts.generation.noBibleContext" />
              </li>
            </ul>
            <p class="mt-3 text-xs text-gray-500">
              {{ counts.generation.observabilityStamped }} asset{{ counts.generation.observabilityStamped === 1 ? '' : 's' }}
              with observability stamps (of {{ counts.assets.totalAssets }} total).
            </p>
          </section>
        </div>

        <p class="text-xs text-gray-500">
          This dashboard is read-only. Review and fix items in Production Bible, timeline, or Assets.
        </p>
      </template>
    </CloudProjectRequired>
  </div>
</template>

<script setup lang="ts">
import { pocketBaseBearerHeaders } from '~/lib/pocketbase-auth-headers'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { countTimelineCloudSaveQueue } from '~/lib/timeline-editor/cloud-save-queue'
import { loadTimelineFromStorage } from '~/lib/timeline-editor/storage'
import { projectTimelineDocumentToEditorDocument } from '~/lib/project-timeline-normalize'
import {
  computeProjectReviewDashboard,
  RECENT_GENERATED_ASSET_DAYS,
  type ProjectReviewDashboardCounts
} from '~/lib/project-review-dashboard'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleFact } from '~/types/bible-fact'
import type { BibleRelationship } from '~/types/bible-relationship'
import type { ProjectAsset } from '~/types/project-asset'
import type { ProjectTimelineGetResponse } from '~/types/project-timeline'

const CountBadge = defineComponent({
  name: 'CountBadge',
  props: {
    value: { type: Number, default: undefined },
    label: { type: String, default: '' },
    warn: { type: Boolean, default: false }
  },
  setup (props) {
    return () => h(
      'span',
      {
        class: [
          'shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full',
          props.warn ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'
        ]
      },
      props.label || String(props.value ?? 0)
    )
  }
})

const { activeProjectId, withProjectQuery } = useCreativeProject()
const { getAuthToken } = useAuth()

const projectId = activeProjectId
const loading = ref(false)
const loadError = ref('')
const counts = ref<ProjectReviewDashboardCounts | null>(null)

const biblePath = computed(() => `/projects/${projectId.value}/bible`)
const timelinePath = computed(() => `/projects/${projectId.value}/timeline`)
const assetsPath = computed(() => withProjectQuery('/assets/video'))

async function loadReviewDashboard () {
  loadError.value = ''
  counts.value = null
  if (!projectId.value) return

  loading.value = true
  try {
    const headers = pocketBaseBearerHeaders(getAuthToken())
    const base = `/api/projects/${projectId.value}`

    const [factsRes, entitiesRes, relRes, assetsRes, timelineRes] = await Promise.all([
      $fetch<{ facts: BibleFact[] }>(`${base}/bible/facts`, { headers }),
      $fetch<{ entities: BibleEntity[] }>(`${base}/bible/entities`, { headers }),
      $fetch<{ relationships: BibleRelationship[] }>(`${base}/bible/relationships`, { headers }),
      $fetch<{ items: ProjectAsset[] }>(`${base}/assets`, { headers }),
      $fetch<ProjectTimelineGetResponse>(`${base}/timeline`, { headers }).catch(() => ({
        timeline: null,
        localStorageKey: ''
      }))
    ])

    const assets = assetsRes.items ?? []
    const assetsById = new Map(assets.map((a) => [a.id, a]))

    let timelineClips = null as ReturnType<typeof projectTimelineDocumentToEditorDocument>['clips'] | null
    if (timelineRes.timeline?.document) {
      timelineClips = projectTimelineDocumentToEditorDocument(timelineRes.timeline.document).clips
    } else if (import.meta.client) {
      const local = loadTimelineFromStorage(projectId.value)
      timelineClips = local?.clips ?? null
    }

    const localDoc = import.meta.client ? loadTimelineFromStorage(projectId.value) : null
    const queuedCloudSave = import.meta.client
      ? countTimelineCloudSaveQueue(projectId.value) > 0
      : false

    counts.value = computeProjectReviewDashboard({
      facts: factsRes.facts ?? [],
      entities: entitiesRes.entities ?? [],
      relationships: relRes.relationships ?? [],
      assets,
      timelineClips,
      cloudTimelineExists: Boolean(timelineRes.timeline),
      localTimelineClipCount: localDoc?.clips.length ?? 0,
      queuedCloudSave,
      assetsById,
      projectId: projectId.value
    })
  } catch (e: unknown) {
    loadError.value = formatApiFetchError(e, 'Could not load review dashboard')
  } finally {
    loading.value = false
  }
}

watch(projectId, () => {
  void loadReviewDashboard()
}, { immediate: true })
</script>
