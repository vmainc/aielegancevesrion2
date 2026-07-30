import { spawn } from 'node:child_process'
import { mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SPEECH_TO_TEXT_PROVIDER_MAX_BYTES } from '~/lib/speech-to-text'

/**
 * OpenAI transcription accepts ~25MB. For larger uploads (app allows up to 100MB),
 * compress to mono 16kHz MP3 suitable for speech.
 */
export async function prepareAudioForOpenAiTranscription (input: {
  data: Buffer
  filename: string
  mime: string
}): Promise<{ data: Buffer; filename: string; mime: string; compressed: boolean }> {
  if (input.data.length <= SPEECH_TO_TEXT_PROVIDER_MAX_BYTES) {
    return {
      data: input.data,
      filename: input.filename,
      mime: input.mime || 'application/octet-stream',
      compressed: false
    }
  }

  const dir = await mkdtemp(join(tmpdir(), 'aie-stt-'))
  const ext = (/\.[a-z0-9]+$/i.exec(input.filename)?.[0] || '.bin').toLowerCase()
  const srcPath = join(dir, `source${ext}`)
  const outPath = join(dir, 'speech.mp3')

  try {
    await writeFile(srcPath, input.data)

    // Try a few bitrates until under the provider cap.
    const bitrates = ['64k', '48k', '32k', '24k']
    let lastError = 'ffmpeg compression failed'
    for (const bitrate of bitrates) {
      try {
        await runFfmpeg([
          '-y',
          '-i',
          srcPath,
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-c:a',
          'libmp3lame',
          '-b:a',
          bitrate,
          outPath
        ])
        const compressed = await readFile(outPath)
        if (compressed.length > 0 && compressed.length <= SPEECH_TO_TEXT_PROVIDER_MAX_BYTES) {
          return {
            data: compressed,
            filename: 'speech.mp3',
            mime: 'audio/mpeg',
            compressed: true
          }
        }
        lastError = `Compressed audio is still too large for the transcription provider (${Math.ceil(compressed.length / (1024 * 1024))} MB). Trim the recording and try again.`
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
    throw new Error(lastError)
  } finally {
    await unlink(srcPath).catch(() => {})
    await unlink(outPath).catch(() => {})
  }
}

function runFfmpeg (args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      if (stderr.length > 4000) stderr = stderr.slice(-4000)
    })
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            'This recording is over 25 MB. Install ffmpeg on the server to auto-compress large uploads, or upload a smaller/compressed MP3.'
          )
        )
        return
      }
      reject(err)
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else {
        reject(
          new Error(
            `Could not compress audio for transcription (ffmpeg exit ${code}). ${stderr.trim().slice(0, 240) || 'Try a smaller MP3.'}`
          )
        )
      }
    })
  })
}
