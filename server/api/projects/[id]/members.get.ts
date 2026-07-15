import { createError, getRouterParam } from 'h3'
import { requireProjectOwnerOnly } from '~/server/utils/bible-project-access'
import { pbRecordToProjectMember } from '~/server/utils/project-member-map'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const { pb } = await requireProjectOwnerOnly(event, projectId)

  try {
    const rows = await pb.collection('project_members').getFullList({
      filter: `project = "${projectId}"`,
      sort: 'created',
      expand: 'user',
      batch: 200
    })
    return {
      items: rows.map(r => pbRecordToProjectMember(r as Record<string, unknown>))
    }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      return { items: [], warning: 'project_members collection missing' }
    }
    throw e
  }
})
