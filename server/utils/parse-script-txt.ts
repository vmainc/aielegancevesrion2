import type { ParsedScene, ParsedScript } from '~/server/utils/parse-script-fdx'

const SCENE_LINE = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)\s+/i

/**
 * Labels that look like all-caps character names but are transitions, scene grammar, or slug lines.
 * Applied to parser output and AI/fallback character lists so they never become `creative_characters` rows.
 */
export function isExcludedScreenplayCharacterLabel (raw: string): boolean {
  const s = raw.trim().replace(/\s+/g, ' ')
  if (s.length < 2 || s.length > 80) return true

  const withoutParenSuffix = s.replace(/\s*\([^)]*\)\s*$/u, '').trim()
  const check = withoutParenSuffix || s

  if (SCENE_LINE.test(check)) return true

  const dePunct = check.replace(/[:.;…!]+$/u, '').trim()
  const u = dePunct.toUpperCase()

  const exact = new Set([
    'END',
    'FIN',
    'THE END',
    'FADE IN',
    'FADE OUT',
    'FADE UP',
    'FADE DOWN',
    'FADE TO BLACK',
    'FADE TO WHITE',
    'CUT TO',
    'CUT BACK TO',
    'QUICK CUT',
    'JUMP CUT',
    'SMASH CUT',
    'MATCH CUT',
    'DISSOLVE',
    'DISSOLVE TO',
    'MONTAGE',
    'TITLE',
    'OMITTED',
    'MORE',
    'CONTINUED',
    'LATER',
    'SAME',
    'FREEZE FRAME',
    'BLACK',
    'CREDITS'
  ])
  if (exact.has(u)) return true

  if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)\b/i.test(check)) return true
  if (/^FADE\b/i.test(check)) return true
  if (/^CUT TO\b|^QUICK CUT|^JUMP CUT/i.test(check)) return true
  if (/^SMASH CUT|^MATCH CUT/i.test(check)) return true
  if (/^DISSOLVE\b|^WIPE TO\b|^IRIS\b/i.test(check)) return true
  if (/^THE END\b/i.test(check)) return true
  if (/^END OF (?:FLASHBACK|FLASH|SCENE|ACT|MONTAGE|TEASER)\b/i.test(check)) return true
  if (/^(?:FLASHBACK|FLASH FORWARD|INTERCUT|SERIES OF SHOTS)\b/i.test(check)) return true
  if (/^(?:TITLE CARD|TITLE SEQUENCE|SUPER|CHYRON)\b/i.test(check)) return true
  if (/^(?:INSERT|ANGLE ON|CLOSE ON|CLOSE UP|WIDER|CLOSER)\b/i.test(check)) return true
  if (/^(?:BACK TO|RETURN TO|PICK UP)\b/i.test(check)) return true
  if (/^(?:TIME CUT|MOMENTS LATER|LATER THAT|NEXT DAY|SAME TIME|MEANWHILE)\b/i.test(check)) return true
  if (/^(?:STOCK SHOT|POV|ESTABLISHING|INSERT SHOT)\b/i.test(check)) return true
  if (/^(?:MUSIC|SOUND|SFX)\b/i.test(check)) return true

  return false
}

export function filterLikelyCharacterNames (names: string[]): string[] {
  return [...new Set(names.map(n => n.trim()).filter(n => n.length > 0 && !isExcludedScreenplayCharacterLabel(n)))]
}

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
      const cleaned = t.replace(/\s*\(.*\)\s*$/, '').trim()
      if (cleaned && !isExcludedScreenplayCharacterLabel(t) && !isExcludedScreenplayCharacterLabel(cleaned)) {
        characterNames.add(cleaned)
      }
    }
    buf.push(line)
  }
  flush()

  if (scenes.length === 0) {
    const names = filterLikelyCharacterNames([...characterNames])
    return {
      scenes: [{ heading: 'FULL SCRIPT', body: raw.trim().slice(0, 50000) || '(empty)' }],
      characterNames: names.sort((a, b) => a.localeCompare(b))
    }
  }

  const names = filterLikelyCharacterNames([...characterNames])
  return { scenes, characterNames: names.sort((a, b) => a.localeCompare(b)) }
}

/**
 * Extra names from scene bodies when parser character list is empty (PDF/plain text,
 * nonstandard formatting, or Title Case cues). Used so script import still creates `creative_characters` rows.
 */
export function heuristicCharacterNamesFromScenes (scenes: ParsedScene[]): string[] {
  const names = new Set<string>()
  for (const s of scenes) {
    for (const line of s.body.split('\n')) {
      const raw = line.trim()
      if (!raw || raw.length < 2 || raw.length > 48) continue
      if (isExcludedScreenplayCharacterLabel(raw)) continue
      if (raw.startsWith('(') && raw.endsWith(')')) continue
      const stripped = raw.replace(/\s*\([^)]*\)\s*$/u, '').trim()
      if (!stripped) continue
      if (isExcludedScreenplayCharacterLabel(stripped)) continue
      if (stripped !== stripped.toUpperCase()) continue
      if (!/^[A-Z][A-Z0-9 .'\-]{0,38}[A-Z0-9]$/.test(stripped)) continue
      const name = stripped.replace(/\s*\([^)]*$/u, '').trim()
      if (name.length < 2 || isExcludedScreenplayCharacterLabel(name)) continue
      names.add(name)
    }
  }
  return [...names].sort()
}
