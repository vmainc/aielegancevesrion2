import { createError, getRouterParam, readBody } from 'h3'
import type { GuideChatMessage } from '~/lib/project-guide'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  guideChatMessageToPbFields,
  pbRecordToGuideChatMessage,
  projectIdOnGuideMessageRow
} from '~/server/utils/guide-message-map'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

function parseMessages (raw: unknown): GuideChatMessage[] {
  if (!Array.isArray(raw)) return []
  const out: GuideChatMessage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const m = item as GuideChatMessage
    if (
      typeof m.id === 'string' &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string'
    ) {
      out.push({
        id: m.id,
        role: m.role,
        content: m.content.slice(0, 12000),
        suggestions: Array.isArray(m.suggestions) ? m.suggestions : undefined,
        createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString()
      })
    }
  }
  return out.slice(-80)
}

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { userId, pb } = await requireProjectOwner(event, projectId || '')

  const body = await readBody<{ messages?: unknown }>(event)
  const messages = parseMessages(body?.messages)

  try {
    const existing = await pb.collection('guide_messages').getFullList({
      filter: `project = "${projectId}" && owned_by = "${userId}"`,
      batch: 200
    })

    const incomingIds = new Set(messages.map(m => m.id))
    for (const row of existing) {
      const rowProject = projectIdOnGuideMessageRow(row as Record<string, unknown>)
      if (rowProject !== projectId) continue
      const clientId = typeof (row as { client_id?: unknown }).client_id === 'string'
        ? (row as { client_id: string }).client_id
        : ''
      if (!incomingIds.has(clientId)) {
        await pb.collection('guide_messages').delete(row.id)
      }
    }

    const existingByClientId = new Map<string, string>()
    for (const row of existing) {
      const clientId = typeof (row as { client_id?: unknown }).client_id === 'string'
        ? (row as { client_id: string }).client_id
        : ''
      if (clientId) existingByClientId.set(clientId, row.id)
    }

    for (const message of messages) {
      const fields = guideChatMessageToPbFields({
        ownerId: userId,
        projectId: projectId || '',
        message
      })
      const existingId = existingByClientId.get(message.id)
      if (existingId) {
        await pb.collection('guide_messages').update(existingId, fields)
      } else {
        const created = await pb.collection('guide_messages').create(fields)
        existingByClientId.set(message.id, created.id)
      }
    }

    const saved = await pb.collection('guide_messages').getFullList({
      filter: `project = "${projectId}" && owned_by = "${userId}"`,
      sort: 'created_at_client,created',
      batch: 200
    })

    const synced = saved
      .map((row) => pbRecordToGuideChatMessage(row as Record<string, unknown>))
      .filter((m): m is NonNullable<typeof m> => !!m)
      .slice(-80)

    return { messages: synced }
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
