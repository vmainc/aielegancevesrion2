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
    'CREDITS',
    'CAST',
    'CAST LIST',
    'CHARACTERS',
    'CHARACTER LIST',
    'ENSEMBLE',
    'EXTRAS',
    'CROWD',
    'VOICES',
    'NARRATOR',
    'VOICE OVER',
    'VOICEOVER',
    'V.O.',
    'O.S.',
    'ALL',
    'EVERYONE',
    'VARIOUS',
    // Generic screenplay placeholders — not real character names
    'HERO',
    'HEROINE',
    'ALLY',
    'PROTAGONIST',
    'ANTAGONIST',
    'VILLAIN',
    'MENTOR',
    'SIDEKICK',
    'LEAD',
    'PARTNER',
    'GUIDE',
    'FOIL',
    'NEMESIS',
    'LOVE INTEREST',
    'MAIN CHARACTER',
    'MAIN CHAR',
    'EVERYMAN',
    'STRANGER'
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

const META_CAST_DESCRIPTION_RE =
  /(?:opening|end)\s+credits|listed in (?:the )?(?:opening )?credits|character introduction section|general reference to (?:the )?(?:animal )?characters|(?:this|only) appears? in (?:the )?credits|not an actual character|meta[- ]?cast|section heading|cast list|credit(?:s)? only|aggregate (?:of )?characters/i

/** AI sometimes invents a row named CAST describing the cast section — drop it. */
export function isMetaCastCharacterEntry (name: string, roleDescription = ''): boolean {
  const n = name.trim()
  if (!n) return true
  if (isExcludedScreenplayCharacterLabel(n)) return true
  const u = n.replace(/\s+/g, ' ').toUpperCase()
  if (u === 'CAST' || u === 'THE CAST' || u === 'CAST LIST') return true
  const d = (roleDescription || '').trim()
  if (d && META_CAST_DESCRIPTION_RE.test(d)) return true
  return false
}

export interface CharacterRowLike {
  name: string
  role_description?: string
}

export function filterCastCharacterRows<T extends CharacterRowLike> (rows: T[]): T[] {
  return rows.filter(
    r => !isMetaCastCharacterEntry(r.name, r.role_description || '')
  )
}
