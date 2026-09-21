import type { FilmControls } from '~/types/image-generation'

/**
 * Build the prompt sent to the model from the user's text + optional film controls.
 * Keeps the user prompt intact; appends filmmaking directives when selected.
 */
export function buildImageFinalPrompt (
  userPrompt: string,
  filmControls?: FilmControls | null
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

  if (!parts.length) {
    return { prompt, finalPrompt: prompt }
  }

  const finalPrompt = `${prompt}\n\nFilmmaking direction: ${parts.join(' ')}`.trim()
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
