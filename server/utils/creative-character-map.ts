import type { CreativeCharacter } from '~/types/creative-project'

export function pbRecordToCreativeCharacter (raw: Record<string, unknown>): CreativeCharacter {
  const pct = raw.screen_share_percent
  const n = typeof pct === 'number' ? pct : Number(pct)
  return {
    id: String(raw.id),
    name: String(raw.name || ''),
    roleDescription: String(raw.role_description || ''),
    screenSharePercent: Number.isFinite(n) ? Math.round(n * 100) / 100 : null
  }
}

export function projectIdOnCharacterRow (raw: Record<string, unknown>): string {
  const p = raw.project
  if (typeof p === 'string') return p
  if (p && typeof p === 'object' && 'id' in p && typeof (p as { id?: string }).id === 'string') {
    return (p as { id: string }).id
  }
  return ''
}
