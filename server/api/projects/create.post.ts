import { createError, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'
import type { ProjectAspectRatio, ProjectGoal } from '~/types/creative-project'

const ASPECT = new Set<ProjectAspectRatio>(['16:9', '9:16', '1:1'])
const GOALS = new Set<ProjectGoal>(['film', 'social', 'commercial', 'other'])

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody<{
    name?: string
    aspectRatio?: string
    goal?: string
  }>(event)

  const nameRaw = typeof body?.name === 'string' ? body.name.trim() : ''
  const name = nameRaw.slice(0, 500) || 'New project'

  const aspectRatio =
    typeof body?.aspectRatio === 'string' && ASPECT.has(body.aspectRatio as ProjectAspectRatio)
      ? (body.aspectRatio as ProjectAspectRatio)
      : '16:9'

  const goal =
    typeof body?.goal === 'string' && GOALS.has(body.goal as ProjectGoal)
      ? (body.goal as ProjectGoal)
      : 'film'

  const pb = await getAuthenticatedPocketBase()

  try {
    const created = await pb.collection('creative_projects').create({
      name,
      owned_by: userId,
      aspect_ratio: aspectRatio,
      goal,
      target_length: 'short',
      synopsis: '',
      treatment: '',
      concept_notes: ''
    })
    const full = await pb.collection('creative_projects').getOne(created.id)
    return {
      project: pbRecordToCreativeProject(full as Parameters<typeof pbRecordToCreativeProject>[0])
    }
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e)
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message:
          'creative_projects collection is missing in PocketBase. From your machine run: npm run setup-db (or node scripts/setup-collections.js) with POCKETBASE_URL pointing at this environment’s PocketBase API (e.g. https://yourdomain.com/pb) and superuser credentials in POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD.'
      })
    }
    throw createError({ statusCode: 500, message: msg })
  }
})
