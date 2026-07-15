import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  pbRecordToGuideChatMessage,
  projectIdOnGuideMessageRow
} from '~/server/utils/guide-message-map'
import { guideStorageKey } from '~/lib/project-guide'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { pb } = await requireProjectOwner(event, projectId || '')

  try {
    const rows = await pb.collection('guide_messages').getFullList({
      filter: `project = "${projectId}"`,
      sort: 'created_at_client,created',
      batch: 200
    })

    const messages = rows
      .map((row) => pbRecordToGuideChatMessage(row as Record<string, unknown>))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .slice(-80)

    return {
      messages,
      localStorageKey: guideStorageKey(projectId || '')
    }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'guide_messages collection is missing. Run npm run setup-db.'
      })
    }
    throw e
  }
})
