const STYLE_FRAGMENTS: Record<string, string> = {
  cinematic:
    'Cinematic lighting, film-quality color grade, shallow depth of field, dramatic but natural shadows.',
  realistic:
    'Photorealistic, natural skin texture, accurate materials, believable environment.',
  anime:
    'Anime-inspired illustration, clean line art, expressive features, cohesive palette.',
  fantasy:
    'Fantasy art direction, rich atmosphere, ornate or otherworldly details where fitting.',
  'sci-fi':
    'Science-fiction aesthetic, sleek or industrial tech details, coherent futuristic setting.',
  custom: 'Follow the description closely; flexible interpretation.'
}

export const CHARACTER_STYLE_PRESETS = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'realistic', label: 'Realistic' },
  { value: 'anime', label: 'Anime' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'custom', label: 'Custom' }
] as const

export function buildCharacterImagePrompt (
  name: string,
  description: string,
  stylePreset: string
): string {
  const style = STYLE_FRAGMENTS[stylePreset] ?? STYLE_FRAGMENTS.custom
  const safeName = (name || '').trim() || 'Character'
  const desc = (description || '').trim() || 'No extra description provided.'
  return [
    'Create a detailed character portrait.',
    '',
    `Character Name: ${safeName}`,
    '',
    'Description:',
    desc,
    '',
    'Style:',
    style,
    '',
    'High detail, consistent lighting, professional quality.'
  ].join('\n')
}

export function isValidStylePreset (key: string): boolean {
  return Object.prototype.hasOwnProperty.call(STYLE_FRAGMENTS, key)
}
