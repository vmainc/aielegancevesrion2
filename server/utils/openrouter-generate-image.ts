import {
  openRouterImageAspectRatio,
  SINGLE_STORYBOARD_FRAME_DIRECTIVE
} from '~/lib/storyboard-frame-image'
import { VIDEO_SEED_IMAGE_GENERATION_DIRECTIVE } from '~/lib/video-start-frame-limits'
import {
  openRouterImageModalities,
  resolveOpenRouterImageSlug
} from '~/server/utils/openrouter-image-models'
import { fetchReferenceImageAsDataUrl } from '~/server/utils/reference-image-data-url'
import { buildSetLockReferenceNote } from '~/lib/set-lock'

export interface OpenRouterGenerateImageResult {
  urls: string[]
  model: string
}

/**
 * Single image generation via OpenRouter (shared by /api/generate/image and batch routes).
 */
export async function openRouterGenerateImage (options: {
  prompt: string
  modelId: string
  apiKey: string
  /** Featured character portrait — image-to-image style guidance when the model supports vision input. */
  referenceImageUrl?: string
  /** Multiple cast portraits / prior frames (preferred over single referenceImageUrl). */
  referenceImageUrls?: string[]
  /** Establishing set plates — match place, not camera. */
  setReferenceImageUrls?: string[]
  /** Prior storyboard stills — same place + cast, new coverage. */
  continuityReferenceImageUrls?: string[]
  aspectRatio?: string
  /** When set, prompt and downstream staging target video image-to-video seed limits. */
  purpose?: 'video_start_frame'
}): Promise<OpenRouterGenerateImageResult> {
  const aspect = openRouterImageAspectRatio(options.aspectRatio)
  const aspectHint =
    aspect === '9:16'
      ? 'Output one 9:16 vertical frame.'
      : aspect === '1:1'
        ? 'Output one 1:1 square frame.'
        : 'Output one 16:9 landscape frame.'
  const prompt = [
    options.purpose === 'video_start_frame'
      ? VIDEO_SEED_IMAGE_GENERATION_DIRECTIVE
      : SINGLE_STORYBOARD_FRAME_DIRECTIVE,
    aspectHint,
    options.prompt.trim()
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000)
  if (!prompt) {
    throw createError({ statusCode: 400, message: 'Prompt is required' })
  }

  const openRouterModel = resolveOpenRouterImageSlug(options.modelId)
  const modalities = openRouterImageModalities(openRouterModel)
  const apiKey = options.apiKey.trim()
  // OpenAI GPT Image via chat completions is slower than Flux/Gemini Flash.
  const requestTimeoutMs = openRouterModel.startsWith('openai/') ? 90_000 : 45_000

  let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = prompt
  const characterRefs = [
    ...(options.referenceImageUrls || []).map(u => (u || '').trim()).filter(Boolean),
    (options.referenceImageUrl || '').trim()
  ].filter((u, i, arr) => arr.indexOf(u) === i)
  const setRefs = (options.setReferenceImageUrls || []).map(u => (u || '').trim()).filter(Boolean)
  const continuityRefs = (options.continuityReferenceImageUrls || []).map(u => (u || '').trim()).filter(Boolean)
  const refList = [...characterRefs, ...setRefs, ...continuityRefs]
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .slice(0, 4)

  if (refList.length) {
    const perImageBudget = refList.length > 1 ? 2_200_000 : 4_000_000
    const imageParts: Array<{ type: 'image_url'; image_url: { url: string } }> = []
    for (const refUrl of refList) {
      try {
        const dataUrl = await fetchReferenceImageAsDataUrl(refUrl, perImageBudget)
        imageParts.push({ type: 'image_url', image_url: { url: dataUrl } })
      } catch {
        /* skip broken ref */
      }
    }
    if (imageParts.length) {
      const notes: string[] = []
      if (characterRefs.length) {
        notes.push(
          characterRefs.length === 1
            ? 'CHARACTER PLATE: use the attached portrait as the exact character design (face, proportions, materials, colors). Match it closely; do not redesign the character.'
            : `CHARACTER PLATES: use the attached ${characterRefs.length} portraits as locked character designs. Match face, species, body, materials, colors, and style exactly. Do not invent new looks.`
        )
      }
      const setNote = buildSetLockReferenceNote(setRefs.length > 0, continuityRefs.length > 0)
      if (setNote) notes.push(setNote)
      const refNote = notes.join(' ')
      userContent = [{ type: 'text', text: `${prompt}\n\n${refNote}` }, ...imageParts]
    } else {
      userContent = `${prompt}\n\n(Match the established character design from the project cast bible and the locked set architecture — photoreal practical location, new camera each panel.)`
    }
  }

  const response = await $fetch<{
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; image_url?: { url?: string } }>
        images?: string[]
      }
    }>
  }>('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    timeout: requestTimeoutMs,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: {
      model: openRouterModel,
      messages: [{ role: 'user', content: userContent }],
      modalities,
      image_config: {
        aspect_ratio: aspect
      }
    }
  })

  const message = response?.choices?.[0]?.message
  const urls: string[] = []

  function addUrl (value: unknown) {
    if (typeof value === 'string' && (value.startsWith('data:') || value.startsWith('http'))) {
      urls.push(value)
    }
  }

  if (message?.images?.length) {
    for (const img of message.images) {
      if (typeof img === 'string') addUrl(img)
      else if (img && typeof img === 'object') {
        const u = (img as { image_url?: { url?: string }; imageUrl?: { url?: string } }).image_url?.url ??
          (img as { imageUrl?: { url?: string } }).imageUrl?.url
        addUrl(u)
      }
    }
  }
  if (Array.isArray(message?.content)) {
    for (const part of message.content) {
      if (part?.type === 'image_url') {
        const u = (part as { image_url?: { url?: string }; imageUrl?: { url?: string } }).image_url?.url ??
          (part as { imageUrl?: { url?: string } }).imageUrl?.url
        addUrl(u)
      }
    }
  }
  if (urls.length === 0 && message) {
    function findDataUrls (obj: unknown): void {
      if (typeof obj === 'string' && obj.startsWith('data:image/')) {
        urls.push(obj)
        return
      }
      if (Array.isArray(obj)) obj.forEach(findDataUrls)
      else if (obj && typeof obj === 'object') Object.values(obj).forEach(findDataUrls)
    }
    findDataUrls(message)
  }

  if (urls.length === 0) {
    throw createError({
      statusCode: 502,
      message: 'No image returned from OpenRouter. Try another model or prompt.'
    })
  }

  return { urls, model: options.modelId }
}
