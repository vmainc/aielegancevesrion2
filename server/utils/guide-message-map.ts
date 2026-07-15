import type { GuideChatMessage, GuideSuggestion } from '~/lib/project-guide'

export function projectIdOnGuideMessageRow (row: Record<string, unknown>): string {
  const project = row.project
  if (typeof project === 'string') return project
  if (project && typeof project === 'object' && 'id' in project) {
    return String((project as { id: string }).id)
  }
  return ''
}

function parseSuggestions (raw: unknown): GuideSuggestion[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: GuideSuggestion[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const s = item as GuideSuggestion
    if (
      typeof s.id === 'string' &&
      typeof s.target === 'string' &&
      typeof s.field === 'string' &&
      typeof s.value === 'string' &&
      typeof s.label === 'string'
    ) {
      out.push(s)
    }
  }
  return out.length ? out : undefined
}

export function pbRecordToGuideChatMessage (record: Record<string, unknown>): GuideChatMessage | null {
  const clientId = typeof record.client_id === 'string' ? record.client_id.trim() : ''
  const role = record.role
  const content = typeof record.content === 'string' ? record.content : ''
  if (!clientId || (role !== 'user' && role !== 'assistant') || !content) return null

  const createdAt =
    typeof record.created_at_client === 'string' && record.created_at_client.trim()
      ? record.created_at_client.trim()
      : typeof record.created === 'string'
        ? record.created
        : new Date().toISOString()

  return {
    id: clientId,
    role,
    content,
    suggestions: parseSuggestions(record.suggestions),
    createdAt
  }
}

export function guideChatMessageToPbFields (input: {
  ownerId: string
  projectId: string
  message: GuideChatMessage
}): Record<string, unknown> {
  return {
    owned_by: input.ownerId,
    project: input.projectId,
    client_id: input.message.id,
    role: input.message.role,
    content: input.message.content.slice(0, 12000),
    suggestions: input.message.suggestions?.length ? input.message.suggestions : null,
    created_at_client: input.message.createdAt
  }
}
