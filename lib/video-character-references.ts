/**
 * Seedance treats start/end frames and reference images as different modes.
 * If both are sent, the frames win and character images are ignored.
 * When lookbook plates are selected, send opening frame, closing frame, and
 * headshots together as reference images so the model actually sees the faces.
 */

export type VideoVisualPlan =
  | {
      mode: 'frames'
      prompt: string
      firstFrameUrl?: string
      lastFrameUrl?: string
    }
  | {
      mode: 'references'
      prompt: string
      referenceUrls: string[]
    }

function cleanUrl (url: string | undefined): string {
  return (url || '').trim()
}

function uniqueUrls (urls: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of urls) {
    const url = raw.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

export function modelAcceptsCharacterReferenceImages (model: string): boolean {
  return /seedance/i.test(model.trim())
}

export type CharacterReferenceImage = {
  name: string
  description: string
  imageUrl: string
}

export function planVideoCharacterReferences (opts: {
  prompt: string
  model: string
  firstFrameUrl?: string
  lastFrameUrl?: string
  characterReferenceUrls?: string[]
  characterReferences?: CharacterReferenceImage[]
}): VideoVisualPlan {
  const prompt = opts.prompt.trim()
  const first = cleanUrl(opts.firstFrameUrl)
  const last = cleanUrl(opts.lastFrameUrl)
  const named = (opts.characterReferences || [])
    .map((c) => ({
      name: (c.name || '').trim(),
      description: (c.description || '').trim(),
      imageUrl: cleanUrl(c.imageUrl)
    }))
    .filter((c) => c.imageUrl)
    .slice(0, 6)
  const characters = named.length
    ? named
    : uniqueUrls(opts.characterReferenceUrls || []).slice(0, 6).map((imageUrl) => ({
        name: '',
        description: '',
        imageUrl
      }))

  if (!modelAcceptsCharacterReferenceImages(opts.model) || !characters.length) {
    return {
      mode: 'frames',
      prompt,
      firstFrameUrl: first || undefined,
      lastFrameUrl: last || undefined
    }
  }

  const slots: Array<{ url: string; role: 'start' | 'end' | 'character'; name: string; description: string }> = []
  if (first) slots.push({ url: first, role: 'start', name: '', description: '' })
  if (last && last !== first) slots.push({ url: last, role: 'end', name: '', description: '' })
  for (const character of characters) {
    if (slots.length >= 9) break
    if (slots.some((s) => s.url === character.imageUrl)) continue
    slots.push({
      url: character.imageUrl,
      role: 'character',
      name: character.name,
      description: character.description
    })
  }

  const lines = ['CHARACTER REFERENCE IMAGES (use these pictures — do not invent different faces):']
  slots.forEach((slot, i) => {
    const n = i + 1
    if (slot.role === 'start') {
      lines.push(`Image ${n} (@image${n}): opening frame. Begin the clip on this image.`)
    } else if (slot.role === 'end') {
      lines.push(`Image ${n} (@image${n}): closing frame. End the clip on this image.`)
    } else {
      const who = slot.name ? slot.name.toUpperCase() : 'character'
      const look = slot.description ? ` ${slot.description}` : ' Match this face exactly, including facial hair, age, and face shape.'
      lines.push(`Image ${n} (@image${n}): ${who} identity headshot.${look}`)
    }
  })
  lines.push('Animate between the opening and closing frames. Each headshot is that named person — do not swap faces.')

  return {
    mode: 'references',
    prompt: `${prompt}\n\n${lines.join('\n')}`,
    referenceUrls: slots.map((s) => s.url)
  }
}
