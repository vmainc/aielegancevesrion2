import type { ParsedScene, ParsedScript } from '~/server/utils/parse-script-fdx'

const SCENE_LINE = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)\s+/i

/**
 * Very simple plain-text screenplay heuristic (not Fountain).
 */
export function parsePlainScriptText (raw: string): ParsedScript {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const characterNames = new Set<string>()
  const scenes: ParsedScene[] = []
  let heading = 'OPENING'
  let buf: string[] = []

  const flush = () => {
    const body = buf.join('\n').trim()
    if (body || heading !== 'OPENING') {
      scenes.push({ heading, body: body || '(no body)' })
    }
    buf = []
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (SCENE_LINE.test(t)) {
      flush()
      heading = t
      continue
    }
    const cap = t.match(/^([A-Z][A-Z0-9 .'\-]{1,40})$/i)
    if (cap && t === t.toUpperCase() && t.length < 45 && !SCENE_LINE.test(t)) {
      characterNames.add(t.replace(/\s*\(.*\)\s*$/, '').trim())
    }
    buf.push(line)
  }
  flush()

  if (scenes.length === 0) {
    return {
      scenes: [{ heading: 'FULL SCRIPT', body: raw.trim().slice(0, 50000) || '(empty)' }],
      characterNames: [...characterNames]
    }
  }

  return { scenes, characterNames: [...characterNames].sort() }
}
