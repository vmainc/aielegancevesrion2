import { XMLParser } from 'fast-xml-parser'

export interface ParsedScene {
  heading: string
  body: string
}

export interface ParsedScript {
  scenes: ParsedScene[]
  characterNames: string[]
}

function paragraphType (p: Record<string, unknown>): string {
  return String(p['@_Type'] || p.Type || p.type || '').trim()
}

function paragraphText (p: Record<string, unknown>): string {
  const t = p.Text
  if (t == null) return ''
  if (typeof t === 'string' || typeof t === 'number') return String(t)
  if (Array.isArray(t)) {
    return t
      .map(x => {
        if (typeof x === 'string' || typeof x === 'number') return String(x)
        if (x && typeof x === 'object' && '#text' in x) return String((x as { '#text': string })['#text'])
        return ''
      })
      .join('')
  }
  if (typeof t === 'object' && '#text' in t) {
    return String((t as { '#text': string })['#text'])
  }
  return ''
}

function paragraphListFromContent (content: unknown): Array<Record<string, unknown>> {
  if (!content || typeof content !== 'object') return []
  const c = content as Record<string, unknown>
  const p = c.Paragraph
  if (!p) return []
  return (Array.isArray(p) ? p : [p]) as Array<Record<string, unknown>>
}

/**
 * Minimal reliable FDX parse: Paragraph elements with Type attribute (Final Draft XML).
 */
export function parseFdxXml (xml: string): ParsedScript {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (tagName) => tagName === 'Paragraph' || tagName === 'Text'
  })

  let root: unknown
  try {
    root = parser.parse(xml)
  } catch {
    throw new Error('Invalid XML (not a valid .fdx file)')
  }

  const doc = root as Record<string, unknown>
  const fd = (doc.FinalDraft || doc.finalDraft || doc) as Record<string, unknown>
  const content = fd.Content || (doc as Record<string, unknown>).Content

  const rawParas = paragraphListFromContent(content)
  const paragraphs = rawParas.map(p => ({
    type: paragraphType(p),
    text: paragraphText(p).trim()
  }))

  const characterNames = new Set<string>()
  const scenes: ParsedScene[] = []
  let currentHeading = 'UNSPECIFIED'
  let bodyLines: string[] = []

  const flushScene = () => {
    const body = bodyLines.join('\n').trim()
    if (!body && currentHeading === 'UNSPECIFIED') return
    scenes.push({
      heading: currentHeading,
      body: body || '(no body)'
    })
    bodyLines = []
  }

  for (const p of paragraphs) {
    const t = p.type
    const text = p.text
    if (t === 'Character') {
      if (text) characterNames.add(text.replace(/\s*\(.*\)\s*$/, '').trim())
      bodyLines.push(text ? `${text}:` : '')
      continue
    }
    if (t === 'Scene Heading' || t === 'SceneHeading') {
      flushScene()
      currentHeading = text || 'UNTITLED SCENE'
      continue
    }
    if (t === 'Dialogue' || t === 'Parenthetical') {
      if (text) bodyLines.push(t === 'Parenthetical' ? `(${text})` : text)
      continue
    }
    if (t === 'Transition' || t === 'Shot') {
      if (text) bodyLines.push(`[${t}] ${text}`)
      continue
    }
    if (text) bodyLines.push(text)
  }
  flushScene()

  if (scenes.length === 0 && paragraphs.some(p => p.text)) {
    const blob = paragraphs.map(x => x.text).filter(Boolean).join('\n')
    return {
      scenes: [{ heading: 'FULL SCRIPT', body: blob.trim() }],
      characterNames: [...characterNames]
    }
  }

  return {
    scenes,
    characterNames: [...characterNames].sort()
  }
}
