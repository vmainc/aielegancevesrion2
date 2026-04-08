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

/**
 * Extract plain text from a PDF buffer for screenplay parsing.
 * Image-only (scanned) PDFs return empty text — caller should surface a clear error.
 */
export async function extractTextFromPdfBuffer (buffer: Buffer): Promise<string> {
  let PDFParseCtor: undefined | (new (input: { data: Uint8Array }) => {
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

  const parser = new PDFParseCtor({ data: new Uint8Array(buffer) })
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
    const fallback = extractTextNaiveFromPdfBytes(buffer)
    if (fallback.length >= MIN_CHARS) return fallback
    throw new Error('PDF parsing failed on this server for this file. Upload .fdx or .txt, or try another text-based PDF export.')
  } finally {
    await parser.destroy()
  }
}
