const MIN_CHARS = 80

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
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `PDF parser is unavailable on this server (${msg || 'unknown error'}). Upload .fdx or .txt, or install the PDF runtime dependency.`
    )
  }
  if (!PDFParseCtor) {
    throw new Error('PDF parser is unavailable on this server. Upload .fdx or .txt instead.')
  }

  const parser = new PDFParseCtor({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    const text = (result.text || '').replace(/\r\n/g, '\n').trim()
    if (text.length < MIN_CHARS) {
      throw new Error(
        'Little or no text found in this PDF. It may be scanned images only — try a text-based PDF or export from your screenwriting app as .fdx or .txt.'
      )
    }
    return text
  } finally {
    await parser.destroy()
  }
}
