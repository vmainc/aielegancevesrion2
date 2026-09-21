import type { FilmControls, ImageGenerationCategory, ImageGenerationRecord } from '~/types/image-generation'
import type { ImageModel, ImageModelBadge } from '~/types/image-generation'
import { EMPTY_FILM_CONTROLS } from '~/lib/image-generation-defaults'
import { pickDefaultAspectRatio } from '~/lib/normalize-image-model'
import { pocketBaseBearerHeaders } from '~/lib/pocketbase-auth-headers'
import { appendPlaybackAccessToken } from '~/lib/project-asset-playback-url'

export type ImageModelsApiResponse = {
  source: string
  defaultModelId: string
  notice?: string
  models: Array<
    ImageModel & {
      priceLabel?: string | null
    }
  >
}

export function useImageGeneration () {
  const { getAuthToken } = useAuth()
  const toast = useToast()

  const prompt = ref('')
  const modelId = ref('')
  const aspectRatio = ref('16:9')
  const resolution = ref<string | null>(null)
  const imageCount = ref(1)
  const category = ref<ImageGenerationCategory>('other')
  const filmControls = ref<FilmControls>({ ...EMPTY_FILM_CONTROLS })
  const advancedOpen = ref(false)
  const advanced = ref({
    seed: null as number | null,
    guidance: null as number | null,
    strength: null as number | null,
    style: null as string | null,
    negativePrompt: null as string | null,
    background: null as string | null,
    outputFormat: null as string | null
  })
  const referenceFiles = ref<File[]>([])
  const referencePreviewUrls = ref<string[]>([])
  const projectId = ref('')
  const sceneId = ref('')
  const shotId = ref('')
  const frameRole = ref<'start' | 'end'>('start')
  const returnTo = ref('')
  const prefillSource = ref<'storyboard_panel' | 'standalone' | 'video_tool' | ''>('')
  const lastAttachedStoryboardAssetId = ref<string | null>(null)

  const generating = ref(false)
  const formError = ref('')
  const latest = ref<ImageGenerationRecord | null>(null)
  const history = ref<ImageGenerationRecord[]>([])
  const historyPending = ref(false)
  const historyFilter = ref<'all' | ImageGenerationCategory>('all')
  const detail = ref<ImageGenerationRecord | null>(null)

  const selectedModel = computed(() => {
    return models.value.find((m) => m.id === modelId.value) || null
  })

  const models = ref<ImageModelsApiResponse['models']>([])
  const modelsNotice = ref('')
  const modelsPending = ref(true)
  const defaultModelId = ref('')

  function authHeaders (): Record<string, string> {
    return pocketBaseBearerHeaders(getAuthToken())
  }

  function mediaSrc (url: string): string {
    return appendPlaybackAccessToken(url, getAuthToken())
  }

  async function loadModels () {
    modelsPending.value = true
    try {
      const data = await $fetch<ImageModelsApiResponse>('/api/openrouter/image-models')
      models.value = data.models || []
      defaultModelId.value = data.defaultModelId
      modelsNotice.value = data.notice || ''
      if (!modelId.value || !models.value.some((m) => m.id === modelId.value)) {
        modelId.value = data.defaultModelId || models.value[0]?.id || ''
      }
      syncControlsToModel()
    } catch {
      modelsNotice.value = 'Could not load image models.'
    } finally {
      modelsPending.value = false
    }
  }

  function syncControlsToModel () {
    const m = selectedModel.value
    if (!m) return
    if (m.aspectRatios.length) {
      aspectRatio.value = pickDefaultAspectRatio(m.aspectRatios)
    }
    if (m.resolutions.length) {
      if (!resolution.value || !m.resolutions.includes(resolution.value)) {
        resolution.value = m.resolutions[0] || null
      }
    } else {
      resolution.value = null
    }
    if (imageCount.value > m.maxImages) {
      imageCount.value = Math.max(1, m.maxImages)
    }
    if (!m.supportsReferences) {
      clearReferences()
    }
  }

  watch(modelId, () => syncControlsToModel())

  function clearReferences () {
    for (const u of referencePreviewUrls.value) {
      if (u.startsWith('blob:')) URL.revokeObjectURL(u)
    }
    referenceFiles.value = []
    referencePreviewUrls.value = []
  }

  function addReferenceFiles (files: FileList | File[]) {
    const list = Array.from(files)
    for (const file of list) {
      if (!file.type.startsWith('image/')) continue
      if (referenceFiles.value.length >= 8) break
      referenceFiles.value.push(file)
      referencePreviewUrls.value.push(URL.createObjectURL(file))
    }
  }

  function removeReference (index: number) {
    const url = referencePreviewUrls.value[index]
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    referenceFiles.value.splice(index, 1)
    referencePreviewUrls.value.splice(index, 1)
  }

  async function loadHistory () {
    historyPending.value = true
    try {
      const q = new URLSearchParams()
      if (projectId.value.trim()) q.set('projectId', projectId.value.trim())
      if (historyFilter.value !== 'all') q.set('category', historyFilter.value)
      q.set('perPage', '24')
      const data = await $fetch<{ items: ImageGenerationRecord[]; notice?: string }>(
        `/api/generate/images?${q.toString()}`,
        { headers: authHeaders() }
      )
      history.value = data.items || []
    } catch {
      history.value = []
    } finally {
      historyPending.value = false
    }
  }

  async function generate () {
    formError.value = ''
    if (!prompt.value.trim()) {
      formError.value = 'Describe the image before generating.'
      return
    }
    const m = selectedModel.value
    if (!m) {
      formError.value = 'Select an image model.'
      return
    }
    if (referenceFiles.value.length && !m.supportsReferences) {
      formError.value = 'This model does not support reference images.'
      return
    }

    generating.value = true
    try {
      const fd = new FormData()
      fd.append('prompt', prompt.value.trim())
      fd.append('model', m.id)
      if (projectId.value.trim()) fd.append('projectId', projectId.value.trim())
      if (sceneId.value.trim()) fd.append('sceneId', sceneId.value.trim())
      if (shotId.value.trim()) fd.append('shotId', shotId.value.trim())
      if (shotId.value.trim()) fd.append('frameRole', frameRole.value)
      if (aspectRatio.value) fd.append('aspectRatio', aspectRatio.value)
      if (resolution.value && m.resolutions.length) fd.append('resolution', resolution.value)
      fd.append('n', String(Math.max(1, Math.min(m.maxImages, imageCount.value))))
      fd.append('category', category.value)
      fd.append('filmControls', JSON.stringify(filmControls.value))
      fd.append('advanced', JSON.stringify(advanced.value))
      for (const file of referenceFiles.value) {
        fd.append('references', file, file.name)
      }

      const data = await $fetch<{
        generation: ImageGenerationRecord
        urls: string[]
        notice?: string
        attachedStoryboardAssetId?: string | null
      }>('/api/generate/images', {
        method: 'POST',
        headers: authHeaders(),
        body: fd
      })

      latest.value = data.generation
      lastAttachedStoryboardAssetId.value = data.attachedStoryboardAssetId || null
      if (data.notice) toast.info(data.notice)
      else if (data.attachedStoryboardAssetId) toast.success('Frame attached to storyboard panel')
      else toast.success('Image ready')
      await loadHistory()
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string }; message?: string })?.data?.message ||
        (err as { message?: string })?.message ||
        'Image generation failed.'
      formError.value = msg
      toast.error(msg)
    } finally {
      generating.value = false
    }
  }

  function reusePrompt (gen: ImageGenerationRecord) {
    prompt.value = gen.prompt || ''
    modelId.value = gen.model || modelId.value
    if (gen.aspectRatio) aspectRatio.value = gen.aspectRatio
    if (gen.resolution) resolution.value = gen.resolution
    if (gen.filmControls) filmControls.value = { ...EMPTY_FILM_CONTROLS, ...gen.filmControls }
    if (gen.category) category.value = gen.category
    const settings = gen.generationSettings || {}
    const adv = settings.advanced
    if (adv && typeof adv === 'object') {
      advanced.value = { ...advanced.value, ...(adv as typeof advanced.value) }
    }
    imageCount.value = Math.max(1, gen.imageCount || 1)
    detail.value = null
    toast.info('Prompt and settings loaded — edit, then generate.')
  }

  function createVariation (gen: ImageGenerationRecord) {
    reusePrompt(gen)
    const m = selectedModel.value
    if (m?.supportsReferences && gen.imageUrls?.[0]) {
      toast.info('Variation: prompt loaded. Attach the result as a reference if this model supports it.')
      // Preload reference from generated URL via fetch → blob File
      void (async () => {
        try {
          const src = mediaSrc(gen.imageUrls[0]!)
          const res = await fetch(src)
          if (!res.ok) return
          const blob = await res.blob()
          const file = new File([blob], 'variation-reference.png', { type: blob.type || 'image/png' })
          clearReferences()
          addReferenceFiles([file])
        } catch {
          /* ignore */
        }
      })()
    } else {
      toast.info('Generate again with the same prompt, or pick a model that supports reference images for true variations.')
    }
  }

  async function deleteGeneration (gen: ImageGenerationRecord) {
    try {
      await $fetch(`/api/generate/images/${encodeURIComponent(gen.id)}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      if (latest.value?.id === gen.id) latest.value = null
      if (detail.value?.id === gen.id) detail.value = null
      await loadHistory()
      toast.success('Deleted')
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message || 'Could not delete.'
      toast.error(msg)
    }
  }

  function downloadImage (url: string, index = 0) {
    const src = mediaSrc(url)
    const a = document.createElement('a')
    a.href = src
    a.download = `aifilmstudio-image-${new Date().toISOString().slice(0, 10)}-${String(index + 1).padStart(3, '0')}.png`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function badgeClass (badge: ImageModelBadge): string {
    return 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase border border-gray-300 text-gray-600 bg-gray-50'
  }

  function applyPrefill (prefill: {
    prompt?: string
    projectId?: string
    sceneId?: string
    shotId?: string
    frameRole?: 'start' | 'end'
    aspectRatio?: string
    category?: ImageGenerationCategory
    filmControls?: FilmControls | null
    modelId?: string
    returnTo?: string
    source?: 'storyboard_panel' | 'standalone' | 'video_tool'
  }) {
    if (prefill.prompt?.trim()) prompt.value = prefill.prompt.trim()
    if (prefill.projectId) projectId.value = prefill.projectId
    if (prefill.sceneId) sceneId.value = prefill.sceneId
    if (prefill.shotId) shotId.value = prefill.shotId
    if (prefill.frameRole === 'end' || prefill.frameRole === 'start') {
      frameRole.value = prefill.frameRole
    }
    if (prefill.aspectRatio) aspectRatio.value = prefill.aspectRatio
    if (prefill.category) category.value = prefill.category
    if (prefill.filmControls) {
      filmControls.value = { ...EMPTY_FILM_CONTROLS, ...prefill.filmControls }
    }
    if (prefill.modelId) modelId.value = prefill.modelId
    if (prefill.returnTo) returnTo.value = prefill.returnTo
    if (prefill.source) prefillSource.value = prefill.source
    if (prefill.shotId) category.value = 'storyboards'
  }

  const storyboardContextActive = computed(
    () => Boolean(projectId.value.trim() && sceneId.value.trim() && shotId.value.trim())
  )

  return {
    prompt,
    modelId,
    aspectRatio,
    resolution,
    imageCount,
    category,
    filmControls,
    advancedOpen,
    advanced,
    referenceFiles,
    referencePreviewUrls,
    projectId,
    sceneId,
    shotId,
    frameRole,
    returnTo,
    prefillSource,
    lastAttachedStoryboardAssetId,
    storyboardContextActive,
    generating,
    formError,
    latest,
    history,
    historyPending,
    historyFilter,
    detail,
    models,
    modelsNotice,
    modelsPending,
    selectedModel,
    loadModels,
    loadHistory,
    generate,
    reusePrompt,
    createVariation,
    deleteGeneration,
    downloadImage,
    mediaSrc,
    addReferenceFiles,
    removeReference,
    clearReferences,
    syncControlsToModel,
    applyPrefill,
    badgeClass
  }
}
