import { PDFParse } from 'pdf-parse'

const MIN_CHARS = 80

/**
 * Extract plain text from a PDF buffer for screenplay parsing.
 * Image-only (scanned) PDFs return empty text — caller should surface a clear error.
 */
export async function extractTextFromPdfBuffer (buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
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
