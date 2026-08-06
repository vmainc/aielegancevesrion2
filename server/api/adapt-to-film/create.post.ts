import { createError, readBody } from 'h3'
import {
  createEmptyAdaptState,
  validateAdaptSourceText,
  WORKFLOW_ADAPT_MARKER
} from '~/lib/adapt-to-film'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'
import { saveAdaptState } from '~/server/utils/adapt-to-film-state'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import {
  formatPocketBaseRecordError,
  isPocketBaseMissingCollectionError
} from '~/server/utils/pb-missing-collection-error'
import type { AdaptSourceType } from '~/types/adapt-to-film'

const SOURCE_TYPES = new Set<AdaptSourceType>([
  'transcript',
  'short_story',
  'screenplay',
  'article',
  'historical_document',
  'original_concept',
  'other'
])

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  checkRateLimit(rateLimitKey(userId, 'adapt-to-film-create'), 10, 60_000)

  const body = await readBody<{
    projectTitle?: string
    sourceText?: string
    sourceType?: string
    sourceTitle?: string
    sourceAuthor?: string
    sourceDate?: string
    sourceNotes?: string
    originalFilename?: string
    originalAudioFilename?: string
    speechToTextJobId?: string
  }>(event)

  const sourceText = String(body?.sourceText || '').trim()
  const sourceErr = validateAdaptSourceText(sourceText)
  if (sourceErr) {
    throw createError({ statusCode: 400, message: sourceErr })
  }

  const sourceType =
    typeof body?.sourceType === 'string' && SOURCE_TYPES.has(body.sourceType as AdaptSourceType)
      ? (body.sourceType as AdaptSourceType)
      : 'other'

  const projectTitle =
    String(body?.projectTitle || body?.sourceTitle || 'Adapted Film').trim().slice(0, 200) ||
    'Adapted Film'

  const state = createEmptyAdaptState({
    projectTitle,
    originalSourceText: sourceText,
    workingSourceText: sourceText,
    sourceMeta: {
      sourceTitle: String(body?.sourceTitle || projectTitle).slice(0, 300),
      sourceType,
      sourceAuthor: body?.sourceAuthor ? String(body.sourceAuthor).slice(0, 200) : undefined,
      sourceDate: body?.sourceDate ? String(body.sourceDate).slice(0, 40) : undefined,
      sourceNotes: body?.sourceNotes ? String(body.sourceNotes).slice(0, 2000) : undefined,
      originalFilename: body?.originalFilename
        ? String(body.originalFilename).slice(0, 300)
        : undefined,
      originalAudioFilename: body?.originalAudioFilename
        ? String(body.originalAudioFilename).slice(0, 300)
        : undefined,
      speechToTextJobId: body?.speechToTextJobId
        ? String(body.speechToTextJobId).slice(0, 80)
        : undefined
    }
  })
  state.stage = 'adaptation'

  const pb = await getAuthenticatedPocketBase()
  const conceptNotes = `${WORKFLOW_ADAPT_MARKER}\n`

  const basePayload: Record<string, unknown> = {
    name: projectTitle,
    owned_by: userId,
    aspect_ratio: '16:9',
    goal: 'film',
    preferred_model_id: 'gpt-4o',
    target_length: 'short',
    synopsis: state.sourceMeta.sourceTitle || '',
    treatment: '',
    concept_notes: conceptNotes,
    adapt_to_film: state
  }

  const createAttempts: Array<Record<string, unknown>> = [
    { ...basePayload, workflow_mode: 'adapt' },
    { ...basePayload, workflow_mode: 'import' },
    { ...basePayload }
  ]

  try {
    let created: { id: string } | null = null
    let lastErr: unknown = null
    for (const payload of createAttempts) {
      try {
        created = await pb.collection('creative_projects').create(payload)
        break
      } catch (e: unknown) {
        lastErr = e
        const msg = String((e as { message?: string })?.message || e).toLowerCase()
        if (msg.includes('adapt_to_film') || msg.includes('unknown')) {
          const { adapt_to_film: _drop, ...rest } = payload
          try {
            created = await pb.collection('creative_projects').create(rest)
            break
          } catch (e2: unknown) {
            lastErr = e2
          }
        }
      }
    }
    if (!created) throw lastErr ?? new Error('Could not create project.')

    try {
      await saveAdaptState(pb, created.id, state)
    } catch {
      /* adapt_to_film field may be missing until npm run add-fields */
    }

    const full = await pb.collection('creative_projects').getOne(created.id)
    const project = pbRecordToCreativeProject(
      full as unknown as Parameters<typeof pbRecordToCreativeProject>[0]
    )
    project.workflowMode = 'adapt'

    return {
      project,
      adapt: state,
      landingPath: `/projects/${created.id}/adapt`
    }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message:
          'creative_projects collection is missing. Run npm run setup-db against this PocketBase.'
      })
    }
    const detail = formatPocketBaseRecordError(e)
    throw createError({
      statusCode: 500,
      message:
        detail && detail !== 'Failed to create record.'
          ? detail
          : 'Could not create Adapt to Film project. If this is a new install, run: npm run add-fields'
    })
  }
})
