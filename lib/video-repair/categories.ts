/** User-facing visual/audio issue categories for Fix Shot. */

export const REPAIR_CATEGORY_IDS = [
  'face_eyes',
  'character_consistency',
  'skin_tone',
  'hair',
  'clothing',
  'animal_creature',
  'object_prop',
  'background',
  'lighting_color',
  'lip_sync',
  'voice',
  'other'
] as const

export type RepairCategoryId = (typeof REPAIR_CATEGORY_IDS)[number]

export type RepairCategoryKind = 'visual' | 'audio'

export type RepairCategoryDef = {
  id: RepairCategoryId
  label: string
  kind: RepairCategoryKind
  /** Short phrase injected into the server-side repair prompt. */
  promptFocus: string
}

export const REPAIR_CATEGORIES: RepairCategoryDef[] = [
  {
    id: 'face_eyes',
    label: 'Face / Eyes',
    kind: 'visual',
    promptFocus:
      'Correct iris/eye color, eye size, and facial proportions. The named eye/face fix must be clearly visible in every frame.'
  },
  {
    id: 'character_consistency',
    label: 'Character Consistency',
    kind: 'visual',
    promptFocus: 'Maintain the same character identity and appearance throughout the shot based on the supplied reference.'
  },
  {
    id: 'skin_tone',
    label: 'Skin Tone',
    kind: 'visual',
    promptFocus: 'Keep skin tone consistent with the reference. Prevent color or lighting from changing the complexion.'
  },
  {
    id: 'hair',
    label: 'Hair',
    kind: 'visual',
    promptFocus: 'Keep hair style, color, length and silhouette consistent with the reference.'
  },
  {
    id: 'clothing',
    label: 'Clothing',
    kind: 'visual',
    promptFocus: 'Keep wardrobe, fabric, color and silhouette consistent. Do not change costume.'
  },
  {
    id: 'animal_creature',
    label: 'Animal / Creature',
    kind: 'visual',
    promptFocus: 'Keep the animal or creature the same breed, markings, size and identity throughout the shot.'
  },
  {
    id: 'object_prop',
    label: 'Object / Prop',
    kind: 'visual',
    promptFocus: 'Keep props and objects consistent in appearance. Prevent objects from disappearing or morphing.'
  },
  {
    id: 'background',
    label: 'Background',
    kind: 'visual',
    promptFocus: 'Keep the environment and background consistent. Do not redesign the location.'
  },
  {
    id: 'lighting_color',
    label: 'Lighting / Color',
    kind: 'visual',
    promptFocus: 'Stabilize lighting and color. Prevent unexpected grade or exposure shifts.'
  },
  {
    id: 'lip_sync',
    label: 'Lip Sync',
    kind: 'visual',
    promptFocus: 'Correct mouth shapes so they match the existing dialogue timing. Do not change the performance otherwise.'
  },
  {
    id: 'voice',
    label: 'Voice',
    kind: 'audio',
    promptFocus: ''
  },
  {
    id: 'other',
    label: 'Other',
    kind: 'visual',
    promptFocus: 'Correct only the continuity problem described by the filmmaker.'
  }
]

const BY_ID = new Map(REPAIR_CATEGORIES.map(c => [c.id, c]))

export function isRepairCategoryId (v: unknown): v is RepairCategoryId {
  return typeof v === 'string' && (REPAIR_CATEGORY_IDS as readonly string[]).includes(v)
}

export function repairCategoryById (id: RepairCategoryId): RepairCategoryDef {
  return BY_ID.get(id) || REPAIR_CATEGORIES[REPAIR_CATEGORIES.length - 1]!
}

export function parseRepairCategoryIds (raw: unknown): RepairCategoryId[] {
  if (!Array.isArray(raw)) return []
  const out: RepairCategoryId[] = []
  const seen = new Set<string>()
  for (const x of raw) {
    if (!isRepairCategoryId(x) || seen.has(x)) continue
    seen.add(x)
    out.push(x)
  }
  return out
}

export function visualRepairCategories (ids: RepairCategoryId[]): RepairCategoryId[] {
  return ids.filter(id => repairCategoryById(id).kind === 'visual')
}

export function hasVoiceOnlyRepair (ids: RepairCategoryId[]): boolean {
  const visual = visualRepairCategories(ids)
  return ids.includes('voice') && visual.length === 0
}

export function hasVoiceRepair (ids: RepairCategoryId[]): boolean {
  return ids.includes('voice')
}
