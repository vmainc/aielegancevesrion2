# Speech to Text

Upload an audio recording and convert spoken audio into an editable transcript.

## Overview

- Route: `/tools/speech-to-text` (signed-in Tools section)
- Provider: OpenRouter Speech-to-Text (`/api/v1/audio/transcriptions`)
- Default model: `openai/whisper-1`
- Optional speaker labels: `openai/gpt-4o-transcribe-diarize` (experimental; falls back to Whisper)
- Cleaned style: light post-pass via `openai/gpt-4o-mini` (OpenRouter ignores Whisper `prompt`)
- Processing: asynchronous job + client poll (same family as music/video jobs)
- Temporary audio staged under `.data/speech-to-text/` and deleted after the job finishes

## Required environment variables

Uses the same OpenRouter key as the rest of the app:

```env
OPENROUTER_API_KEY=sk-or-v1-...
# or
NUXT_OPENROUTER_API_KEY=sk-or-v1-...
```

Also requires the usual PocketBase auth stack so API routes can resolve the signed-in user.

See `.env.example` and `ENV_SETUP.md`.

## Supported formats

- MP3 (`.mp3`)
- WAV (`.wav`)
- M4A (`.m4a`)
- WebM / OGG / MPEG / MPGA when the browser provides a valid audio MIME or extension

## File-size limit

**100 MB** per upload (application limit).

OpenRouter’s multipart / upstream Whisper path still caps each request at **25 MB**. Files larger than that are compressed server-side with **ffmpeg** (mono 16 kHz MP3) before transcription. Install `ffmpeg` on the VPS for large-file support.

Nginx must allow bodies over 100 MB (`client_max_body_size 110m` in `deploy/nginx-aielegance-site.conf`). After updating nginx on the server:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Local development

1. Set `OPENROUTER_API_KEY` in `.env` (already required for other AI features)
2. `npm run dev:pb` (or `npm run pb:serve` + `npm run dev`)
3. Sign in → **Tools → Speech to Text**
4. Upload an MP3/WAV and click **Transcribe Audio**

## Options

| Option | Behavior |
|--------|----------|
| Verbatim | Keep the raw Whisper transcript |
| Cleaned | Post-process via OpenRouter to remove fillers and clarify punctuation |
| Language | Auto-detect (default) or English; structured for more locales later |
| Speaker labels | Experimental diarization model when available |
| Timestamps | Segment timestamps in the editable transcript + SRT download |

## Storage / history

- Job state is **in-memory** (lost on server restart), matching other generation tools
- Browser **Recent Transcriptions** uses `localStorage` for the current device only
- No PocketBase collection in v1 (avoids a new schema migration)

## Usage / credits

There is no live billing system yet. `SPEECH_TO_TEXT_CREDITS_PER_AUDIO_MINUTE` in `lib/speech-to-text.ts` is a named placeholder so duration-based metering can be wired later without inventing prices. Jobs track `usageCharged` so a future hook will not double-charge retries.

## Known limitations

- 100 MB app upload cap; files over 25 MB are compressed with ffmpeg before OpenRouter
- Speaker diarization is experimental and may fail over to plain Whisper
- In-memory jobs are not durable across deploys/restarts
- Recent history is local to the browser, not synced across devices

## Recommended next improvements

- Persist transcripts in PocketBase when a shared history product need appears
- Optional audio splitting for very long recordings (upstream ~60s processing timeout)
- More language presets
- Project-scoped “attach transcript to scene/script asset” action
