import type { Ref } from 'vue'
import type { CreativeShot } from '~/types/creative-shot'
import type { CreativeSceneListItem } from '~/types/creative-scene'
import type { CreativeProject } from '~/types/creative-project'
import {
  perSceneShotCap,
  resolveProjectDurationBudget
} from '~/lib/project-duration-budget'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'

export function useStoryboardScene (options: {
  projectId: Ref<string | undefined>
  project: Ref<CreativeProject | null | undefined>
  clientReady: Ref<boolean>
  isAuthenticated: Ref<boolean>
  isCloudProject: Ref<boolean>
  shots: Ref<CreativeShot[]>
  shotsLoading: Ref<boolean>
  getAuthToken: () => string | null
}) {
  const route = useRoute()

  const scenes = ref<CreativeSceneListItem[]>([])
  const selectedSceneId = ref('')
  const scenesLoadError = ref('')

  const durationBudget = computed(() =>
    options.project.value
      ? resolveProjectDurationBudget({
          targetDurationSeconds: options.project.value.targetDurationSeconds,
          targetLength: options.project.value.targetLength,
          goal: options.project.value.goal
        })
      : null
  )

  const activeScene = computed(() => scenes.value.find(s => s.id === selectedSceneId.value))

  const activeSceneIndex = computed(() =>
    Math.max(0, scenes.value.findIndex(s => s.id === selectedSceneId.value))
  )

  const activeSceneShotCount = computed(() => {
    if (selectedSceneId.value && options.shots.value.length && !options.shotsLoading.value) {
      return options.shots.value.length
    }
    const n = Number(activeScene.value?.shotCount || 0)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  })

  const activeSceneClipSeconds = computed(() =>
    options.shots.value.reduce(
      (sum, sh) => sum + snapToStoryboardClipSeconds(Number(sh.durationSeconds) || 5),
      0
    )
  )

  const activeScenePanelEstimate = computed(() => {
    const budget = durationBudget.value
    if (!budget || !scenes.value.length) return ''
    const cap = perSceneShotCap(budget, scenes.value.length, activeSceneIndex.value)
    if (cap.minShots === cap.maxShots) {
      return `${cap.maxShots} panel${cap.maxShots === 1 ? '' : 's'}`
    }
    return `${cap.minShots}–${cap.maxShots} panels`
  })

  const storyboardTimingWarning = computed(() => {
    const budget = durationBudget.value
    if (!budget || !scenes.value.length) return ''
    const totalPanels = scenes.value.reduce(
      (sum, s) => sum + Math.max(0, Math.floor(Number(s.shotCount) || 0)),
      0
    )
    if (totalPanels <= budget.maxPanelsTotal) return ''
    const estSeconds = totalPanels * budget.clipSeconds
    return `This project targets ~${budget.totalSeconds}s (${budget.maxPanelsTotal} panels at ${budget.clipSeconds}s each), but you have ${totalPanels} panels (~${estSeconds}s). Rebuild from Director or trim scenes on the Scenes tab.`
  })

  function scenePanelLabel (scene: CreativeSceneListItem): string {
    const existing = Number(scene.shotCount || 0)
    if (Number.isFinite(existing) && existing > 0) {
      return `${Math.floor(existing)} panel${Math.floor(existing) === 1 ? '' : 's'}`
    }
    const budget = durationBudget.value
    if (budget && scenes.value.length) {
      const idx = scenes.value.findIndex(s => s.id === scene.id)
      const cap = perSceneShotCap(budget, scenes.value.length, Math.max(0, idx))
      if (cap.maxShots < 1) return 'over budget'
      if (cap.minShots === cap.maxShots) return `${cap.maxShots} panel${cap.maxShots === 1 ? '' : 's'}`
      return `${cap.minShots}–${cap.maxShots} panels`
    }
    return 'est. 1–6 panels'
  }

  async function authHeaders () {
    const token = options.getAuthToken()
    if (!token) return null
    return { Authorization: `Bearer ${token}` }
  }

  async function loadScenes () {
    scenesLoadError.value = ''
    if (!options.isCloudProject.value || !options.isAuthenticated.value) {
      scenes.value = []
      return
    }
    const id = options.projectId.value
    if (!id) return
    const headers = await authHeaders()
    if (!headers) return
    try {
      const res = await $fetch<{ scenes: CreativeSceneListItem[] }>(`/api/projects/${id}/scenes`, { headers })
      scenes.value = res.scenes || []
      if (!scenes.value.length) {
        selectedSceneId.value = ''
        options.shots.value = []
        return
      }
      const sceneFromQuery = typeof route.query.scene === 'string' ? route.query.scene : ''
      if (sceneFromQuery && scenes.value.some(s => s.id === sceneFromQuery)) {
        selectedSceneId.value = sceneFromQuery
      } else if (!selectedSceneId.value || !scenes.value.some(s => s.id === selectedSceneId.value)) {
        selectedSceneId.value = scenes.value[0].id
      }
    } catch (e: any) {
      scenes.value = []
      selectedSceneId.value = ''
      options.shots.value = []
      scenesLoadError.value =
        e?.data?.message || e?.message || 'Could not load scenes.'
    }
  }

  watch(
    () => [options.clientReady.value, options.isAuthenticated.value, options.project.value?.id, options.project.value?.source] as const,
    () => {
      void loadScenes()
    },
    { immediate: true }
  )

  return {
    scenes,
    selectedSceneId,
    scenesLoadError,
    loadScenes,
    activeScene,
    activeSceneIndex,
    activeSceneShotCount,
    activeSceneClipSeconds,
    activeScenePanelEstimate,
    durationBudget,
    storyboardTimingWarning,
    scenePanelLabel
  }
}
