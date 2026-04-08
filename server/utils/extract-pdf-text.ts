const MIN_CHARS = 80

function decodePdfEscapes (s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
}

/**
 * Lightweight PDF text fallback for servers where pdfjs worker/canvas is unavailable.
 * This only works for text-based PDFs (not scanned/image-only PDFs).
 */
function extractTextNaiveFromPdfBytes (buffer: Buffer): string {
  const raw = buffer.toString('latin1')
  const out: string[] = []

  // Capture "(...)" strings typically used before Tj/TJ operators.
  const parenStrings = raw.match(/\((?:\\.|[^\\()])+\)\s*TJ?/g) || []
  for (const token of parenStrings) {
    const m = token.match(/\(([\s\S]*?)\)\s*TJ?/)
    if (!m) continue
    out.push(decodePdfEscapes(m[1]))
  }

  // Some producers use hex strings "<...>" before Tj/TJ.
  const hexStrings = raw.match(/<([0-9A-Fa-f\s]{4,})>\s*TJ?/g) || []
  for (const token of hexStrings) {
    const m = token.match(/<([0-9A-Fa-f\s]{4,})>\s*TJ?/)
    if (!m) continue
    const hex = m[1].replace(/\s+/g, '')
    if (hex.length % 2 !== 0) continue
    try {
      const bytes = Buffer.from(hex, 'hex')
      out.push(bytes.toString('utf8'))
    } catch {
      // ignore malformed chunks
    }
  }

  return out
    .join('\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractTextWithPdf2Json (buffer: Buffer): Promise<string> {
  type Pdf2JsonModule = {
    default?: new () => {
      on: (event: string, cb: (arg: unknown) => void) => void
      parseBuffer: (buf: Buffer) => void
    }
  }
  const mod = await import('pdf2json') as Pdf2JsonModule
  const PDFParserCtor = mod.default
  if (!PDFParserCtor) return ''

  const parser = new PDFParserCtor()
  return await new Promise<string>((resolve) => {
    parser.on('pdfParser_dataError', () => resolve(''))
    parser.on('pdfParser_dataReady', (raw: unknown) => {
      const rows: string[] = []
      const pages = raw && typeof raw === 'object' && 'Pages' in (raw as Record<string, unknown>)
        ? ((raw as { Pages?: Array<{ Texts?: Array<{ R?: Array<{ T?: string }> }> }> }).Pages || [])
        : []
      for (const p of pages) {
        const texts = p.Texts || []
        for (const t of texts) {
          const runs = t.R || []
          for (const r of runs) {
            const token = typeof r.T === 'string' ? r.T : ''
            if (!token) continue
            try {
              rows.push(decodeURIComponent(token))
            } catch {
              rows.push(token)
            }
          }
        }
      }
      resolve(
        rows
          .join('\n')
          .replace(/\u0000/g, '')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      )
    })
    parser.parseBuffer(buffer)
  })
}

/**
 * Extract plain text from a PDF buffer for screenplay parsing.
 * Image-only (scanned) PDFs return empty text — caller should surface a clear error.
 */
export async function extractTextFromPdfBuffer (buffer: Buffer): Promise<string> {
  let PDFParseCtor: undefined | (new (input: { data: Uint8Array; disableWorker?: boolean }) => {
    getText: () => Promise<{ text?: string }>
    destroy: () => Promise<void>
  })
  try {
    // Lazy import avoids module-load crashes on hosts where pdfjs DOM polyfills are unavailable.
    const mod = await import('pdf-parse')
    PDFParseCtor = (mod as { PDFParse?: typeof PDFParseCtor }).PDFParse
  } catch (e: unknown) {
    const fallback = extractTextNaiveFromPdfBytes(buffer)
    if (fallback.length >= MIN_CHARS) return fallback
    throw new Error('PDF parser is unavailable on this server. Upload .fdx or .txt, or install the PDF runtime dependency.')
  }
  if (!PDFParseCtor) {
    throw new Error('PDF parser is unavailable on this server. Upload .fdx or .txt instead.')
  }

  // Force a worker-free path in server runtimes where pdf.worker.mjs resolution is flaky.
  const PDFParseAny = PDFParseCtor as unknown as { setWorker?: (src?: string) => string }
  if (typeof PDFParseAny.setWorker === 'function') {
    PDFParseAny.setWorker('')
  }
  const parser = new PDFParseCtor({ data: new Uint8Array(buffer), disableWorker: true })
  try {
    const result = await parser.getText()
    const text = (result.text || '').replace(/\r\n/g, '\n').trim()
    if (text.length < MIN_CHARS) {
      const fallback = extractTextNaiveFromPdfBytes(buffer)
      if (fallback.length >= MIN_CHARS) return fallback
      throw new Error('Little or no text found in this PDF. It may be scanned images only — try a text-based PDF or export from your screenwriting app as .fdx or .txt.')
    }
    return text
  } catch (_e: unknown) {
    try {
      const pdf2jsonText = await extractTextWithPdf2Json(buffer)
      if (pdf2jsonText.length >= MIN_CHARS) return pdf2jsonText
    } catch {
      // ignore and keep falling back
    }
    const fallback = extractTextNaiveFromPdfBytes(buffer)
    if (fallback.length >= MIN_CHARS) return fallback
    throw new Error('PDF parsing failed on this server for this file. Upload .fdx or .txt, or try another text-based PDF export.')
  } finally {
    await parser.destroy()
  }
}
