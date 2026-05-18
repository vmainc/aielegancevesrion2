import type { ProjectDirector } from '~/types/creative-project'

function pickStr (o: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

export function parseDirectorBibleFromConceptJson (
  o: Record<string, unknown>
): ProjectDirector | undefined {
  const raw = o.director_bible ?? o.directorBible ?? o.director
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const d = raw as Record<string, unknown>
  const style = pickStr(d, ['style', 'visual_style', 'visualStyle'])
  const tone = pickStr(d, ['tone', 'director_tone', 'directorTone'])
  const camera = pickStr(d, ['camera_preferences', 'camera', 'cameraPreferences'])
  const lighting = pickStr(d, ['lighting_style', 'lighting', 'lightingStyle'])
  const pacing = pickStr(d, ['pacing', 'rhythm'])
  const name = pickStr(d, ['name', 'director_name', 'directorName'])
  if (!style && !tone && !camera && !lighting && !pacing && !name) return undefined
  return {
    name: name.slice(0, 200),
    style: style.slice(0, 2000),
    tone: tone.slice(0, 500),
    camera_preferences: camera.slice(0, 2000),
    lighting_style: lighting.slice(0, 2000),
    pacing: pacing.slice(0, 500)
  }
}
