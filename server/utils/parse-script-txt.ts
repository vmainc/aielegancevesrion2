import type { ParsedScene, ParsedScript } from '~/server/utils/parse-script-fdx'
import { normalizeScreenplayCharacterName } from '~/lib/screenplay-format'
import {
  filterLikelyCharacterNames,
  isExcludedScreenplayCharacterLabel
} from '~/lib/screenplay-character-filter'

export {
  filterCastCharacterRows,
  filterLikelyCharacterNames,
  isExcludedScreenplayCharacterLabel,
  isMetaCastCharacterEntry,
  type CharacterRowLike
} from '~/lib/screenplay-character-filter'

const SCENE_LINE = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)\s+/i
const CAST_HEADER = /^CAST\s*:?\s*$/i

/** Names from a leading CAST block (NAME — description or NAME - description). */
export function parseCastSectionCharacterNames (raw: string): string[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const names: string[] = []
  let inCast = false
  for (const line of lines) {
    const t = line.trim()
    if (!t) {
      if (inCast && names.length > 0) break
      continue
    }
    if (CAST_HEADER.test(t)) {
      inCast = true
      continue
    }
    if (inCast) {
      if (SCENE_LINE.test(t) || /^FADE IN\b/i.test(t) || t === '---') break
      const m = t.match(/^([A-Z][A-Z0-9 .'\-]{1,40})\s*(?:—|--|-)\s+/u)
        || t.match(/^([A-Z][A-Z0-9 .'\-]{1,40})$/u)
      if (m) {
        const norm = normalizeScreenplayCharacterName(m[1]!)
        if (norm && !isExcludedScreenplayCharacterLabel(norm)) names.push(norm)
      }
    }
  }
  return [...new Set(names)]
}

/**
 * Very simple plain-text screenplay heuristic (not Fountain).
 */
export function parsePlainScriptText (raw: string): ParsedScript {
  const castNames = parseCastSectionCharacterNames(raw)
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const characterNames = new Set<string>(castNames)
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
