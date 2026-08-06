import { describe, expect, it } from 'vitest'
import {
  filterCastCharacterRows,
  filterLikelyCharacterNames,
  isExcludedScreenplayCharacterLabel,
  isMetaCastCharacterEntry
} from './screenplay-character-filter'
import { parsePlainScriptText } from '../server/utils/parse-script-txt'

describe('isExcludedScreenplayCharacterLabel', () => {
  it('keeps real character names', () => {
    for (const name of ['DOG', 'CAT', 'MARA', 'CAPTAIN VOSS', 'JANE DOE']) {
      expect(isExcludedScreenplayCharacterLabel(name)).toBe(false)
    }
  })

  it('rejects opening/title/section markers mistaken for cues', () => {
    for (const name of [
      'OPENING',
      'CLOSING',
      'COLD OPEN',
      'TEASER',
      'PROLOGUE',
      'EPILOGUE',
      'OPENING CREDITS',
      'TITLE SEQUENCE',
      'FULL SCRIPT',
      'ACT ONE',
      'ACT 1',
      'ACT I',
      'SCENE 1',
      'SCENE TWO',
      'SEQUENCE 3',
      'CAST',
      'FADE IN',
      'CUT TO',
      'INT. KITCHEN - DAY'
    ]) {
      expect(isExcludedScreenplayCharacterLabel(name), name).toBe(true)
    }
  })
})

describe('filterLikelyCharacterNames', () => {
  it('drops OPENING while keeping DOG and CAT', () => {
    expect(filterLikelyCharacterNames(['DOG', 'OPENING', 'CAT', 'opening'])).toEqual([
      'DOG',
      'CAT'
    ])
  })
})

describe('filterCastCharacterRows', () => {
  it('removes structural rows even with stub descriptions', () => {
    const rows = filterCastCharacterRows([
      {
        name: 'DOG',
        role_description: 'An energetic golden retriever.'
      },
      {
        name: 'OPENING',
        role_description:
          'Identified from screenplay CAST and dialogue. Refresh cast descriptions on the Characters tab if needed.'
      },
      {
        name: 'CAST',
        role_description: 'Opening credits character introduction section.'
      }
    ])
    expect(rows.map(r => r.name)).toEqual(['DOG'])
  })
})

describe('parsePlainScriptText cast hygiene', () => {
  it('does not treat OPENING-style titles as characters', () => {
    const parsed = parsePlainScriptText(`CAST

DOG — a golden retriever
CAT — a tabby

OPENING

DOG
Woof!

CAT
Meow.
`)
    expect(parsed.characterNames).toContain('DOG')
    expect(parsed.characterNames).toContain('CAT')
    expect(parsed.characterNames).not.toContain('OPENING')
  })
})

describe('isMetaCastCharacterEntry', () => {
  it('flags excluded labels without needing description heuristics', () => {
    expect(isMetaCastCharacterEntry('OPENING')).toBe(true)
    expect(isMetaCastCharacterEntry('DOG')).toBe(false)
  })
})
