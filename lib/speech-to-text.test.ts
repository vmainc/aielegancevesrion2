import { describe, expect, it } from 'vitest'
import {
  SPEECH_TO_TEXT_DEFAULT_MODEL,
  SPEECH_TO_TEXT_MAX_BYTES,
  SPEECH_TO_TEXT_PROVIDER,
  countTranscriptWords,
  formatTranscriptWithTimestamps,
  isAllowedSpeechToTextMime,
  parseSpeechToTextOptions,
  sanitizeSpeechToTextFilename,
  segmentsToSrt,
  validateSpeechToTextFileMeta
} from './speech-to-text'

describe('speech-to-text provider constants', () => {
  it('routes through OpenRouter Whisper', () => {
    expect(SPEECH_TO_TEXT_PROVIDER).toBe('openrouter')
    expect(SPEECH_TO_TEXT_DEFAULT_MODEL).toBe('openai/whisper-1')
  })
})

describe('speech-to-text validation', () => {
  it('accepts valid MP3 metadata', () => {
    expect(
      validateSpeechToTextFileMeta({
        filename: 'interview.mp3',
        mime: 'audio/mpeg',
        size: 1024
      })
    ).toBeNull()
  })

  it('accepts valid WAV metadata', () => {
    expect(
      validateSpeechToTextFileMeta({
        filename: 'take-1.wav',
        mime: 'audio/wav',
        size: 2048
      })
    ).toBeNull()
  })

  it('accepts M4A with octet-stream mime when extension is valid', () => {
    expect(isAllowedSpeechToTextMime('application/octet-stream', 'clip.m4a')).toBe(true)
    expect(
      validateSpeechToTextFileMeta({
        filename: 'clip.m4a',
        mime: 'application/octet-stream',
        size: 4096
      })
    ).toBeNull()
  })

  it('rejects unsupported file types', () => {
    const err = validateSpeechToTextFileMeta({
      filename: 'notes.pdf',
      mime: 'application/pdf',
      size: 1024
    })
    expect(err).toMatch(/Unsupported/i)
  })

  it('rejects oversized files', () => {
    const err = validateSpeechToTextFileMeta({
      filename: 'long.mp3',
      mime: 'audio/mpeg',
      size: SPEECH_TO_TEXT_MAX_BYTES + 1
    })
    expect(err).toMatch(/too large/i)
  })

  it('rejects empty files', () => {
    const err = validateSpeechToTextFileMeta({
      filename: 'empty.mp3',
      mime: 'audio/mpeg',
      size: 0
    })
    expect(err).toMatch(/empty|corrupt/i)
  })

  it('sanitizes dangerous filenames', () => {
    expect(sanitizeSpeechToTextFilename('../../etc/passwd.mp3')).toBe('passwd.mp3')
    expect(sanitizeSpeechToTextFilename('my clip?.wav')).toBe('my clip_.wav')
  })
})

describe('speech-to-text formatting', () => {
  it('counts words', () => {
    expect(countTranscriptWords('Hello world from AI')).toBe(4)
    expect(countTranscriptWords('')).toBe(0)
  })

  it('builds SRT from segments', () => {
    const srt = segmentsToSrt([
      { id: 0, start: 0, end: 1.5, text: 'Hello there.' },
      { id: 1, start: 1.5, end: 3, text: 'Welcome back.', speaker: 'Speaker 1' }
    ])
    expect(srt).toContain('00:00:00,000 --> 00:00:01,500')
    expect(srt).toContain('Hello there.')
    expect(srt).toContain('Speaker 1: Welcome back.')
  })

  it('formats transcript with timestamps when requested', () => {
    const text = formatTranscriptWithTimestamps(
      'Hello',
      [{ id: 0, start: 65, end: 70, text: 'Hello there' }],
      true
    )
    expect(text).toContain('[1:05]')
    expect(text).toContain('Hello there')
  })

  it('parses options with safe defaults', () => {
    expect(parseSpeechToTextOptions(null)).toEqual({
      style: 'verbatim',
      language: 'auto',
      speakerLabels: false,
      timestamps: false
    })
    expect(
      parseSpeechToTextOptions({
        style: 'cleaned',
        language: 'en',
        speakerLabels: true,
        timestamps: true
      })
    ).toEqual({
      style: 'cleaned',
      language: 'en',
      speakerLabels: true,
      timestamps: true
    })
  })
})
