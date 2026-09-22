import type { FilmControls } from '~/types/image-generation'

/**
 * Build the prompt sent to the model from the user's text + optional film controls.
 * Keeps the user prompt intact; appends filmmaking directives when selected.
 */
export function buildImageFinalPrompt (
  userPrompt: string,
  filmControls?: FilmControls | null,
  options?: { category?: string | null }
): { prompt: string; finalPrompt: string } {
  const prompt = (userPrompt || '').trim()
  if (!prompt) {
    return { prompt: '', finalPrompt: '' }
  }

  const parts: string[] = []
  const shot = filmControls?.shotSize?.trim()
  const angle = filmControls?.cameraAngle?.trim()
  const lens = filmControls?.lens?.trim()
  const lighting = filmControls?.lighting?.trim()
  const style = filmControls?.style?.trim()

  if (shot) parts.push(`Shot size: ${shot}.`)
  if (angle) parts.push(`Camera angle: ${angle}.`)
  if (lens) parts.push(`Lens: ${lens}.`)
  if (lighting) parts.push(`Lighting: ${lighting}.`)
  if (style) parts.push(`Visual style: ${style}.`)

  const category = (options?.category || '').trim()
  let categoryNote = ''
  if (category === 'storyboards') {
    categoryNote =
      'NO ON-IMAGE TEXT: never comic captions, speech bubbles, subtitles, or readable words in the frame — dialogue is spoken later in video/audio.'
  } else if (category === 'logos') {
    categoryNote =
      'LOGO DESIGN: produce a clean logo mark — intentional typography and/or symbol on a simple background. Readable lettering is desired; avoid photoreal scenes or random watermarks.'
  } else if (category === 'titles') {
    categoryNote =
      'TITLE TREATMENT: cinematic title card or main-title typography — clear readable lettering as the focus. Prefer designed type over busy photographic backgrounds unless the prompt asks for a full poster.'
  } else if (category === 'graphics') {
    categoryNote =
      'GRAPHIC DESIGN ASSET: poster, key art, icon, or motion-graphics still — clean composition; typography allowed when it serves the design.'
  }

  if (!parts.length && !categoryNote) {
    return { prompt, finalPrompt: prompt }
  }

  const direction = [...parts, categoryNote].filter(Boolean).join(' ')
  const finalPrompt = `${prompt}\n\nFilmmaking direction: ${direction}`.trim()
  return { prompt, finalPrompt }
}

export function hasActiveFilmControls (filmControls?: FilmControls | null): boolean {
  if (!filmControls) return false
  return Boolean(
    filmControls.shotSize?.trim() ||
      filmControls.cameraAngle?.trim() ||
      filmControls.lens?.trim() ||
      filmControls.lighting?.trim() ||
      filmControls.style?.trim()
  )
}
