import { spawn } from 'node:child_process'

/**
 * Read media duration via ffprobe. Returns null when ffprobe is missing or fails.
 * Used so Aleph keyframe pins stay within the real clip length (client metadata often overstates it).
 */
export function probeMediaDurationSeconds (filePath: string): Promise<number | null> {
  const path = (filePath || '').trim()
  if (!path) return Promise.resolve(null)

  return new Promise(resolve => {
    let settled = false
    const finish = (value: number | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    let out = ''
    let child
    try {
      child = spawn(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path],
        { stdio: ['ignore', 'pipe', 'ignore'] }
      )
    } catch {
      finish(null)
      return
    }

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        /* ignore */
      }
      finish(null)
    }, 15_000)

    child.stdout?.on('data', (chunk: Buffer | string) => {
      out += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    })
    child.on('error', () => {
      clearTimeout(timer)
      finish(null)
    })
    child.on('close', code => {
      clearTimeout(timer)
      if (code !== 0) {
        finish(null)
        return
      }
      const n = Number(String(out).trim())
      finish(Number.isFinite(n) && n > 0 ? n : null)
    })
  })
}
