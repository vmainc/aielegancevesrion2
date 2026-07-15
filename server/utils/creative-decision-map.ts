import type {
  CreativeDecision,
  CreativeDecisionCreateInput,
  CreativeDecisionStatus,
  CreativeDecisionTargetType
} from '~/types/creative-decision'

const TARGET_TYPES = new Set<CreativeDecisionTargetType>(['project', 'director', 'character'])
const STATUSES = new Set<CreativeDecisionStatus>(['applied', 'rejected', 'superseded'])

function parseTargetType (v: unknown): CreativeDecisionTargetType {
  if (typeof v === 'string' && TARGET_TYPES.has(v as CreativeDecisionTargetType)) {
    return v as CreativeDecisionTargetType
  }
  return 'project'
}

function parseStatus (v: unknown): CreativeDecisionStatus {
  if (typeof v === 'string' && STATUSES.has(v as CreativeDecisionStatus)) {
    return v as CreativeDecisionStatus
  }
  return 'applied'
}

export function projectIdOnDecisionRow (row: Record<string, unknown>): string {
  const project = row.project
  if (typeof project === 'string') return project
  if (project && typeof project === 'object' && 'id' in project) {
    return String((project as { id: string }).id)
  }
  return ''
}

export function pbRecordToCreativeDecision (record: Record<string, unknown>): CreativeDecision {
  const appliedAt =
    typeof record.applied_at === 'string' && record.applied_at.trim()
      ? record.applied_at.trim()
      : typeof record.created === 'string'
        ? record.created
        : new Date().toISOString()

  return {
    id: String(record.id ?? ''),
    projectId: projectIdOnDecisionRow(record),
    actorType: typeof record.actor_type === 'string' ? record.actor_type : 'user',
    actorId: typeof record.actor_id === 'string' ? record.actor_id : '',
    sourceType: typeof record.source_type === 'string' ? record.source_type : '',
    sourceId: typeof record.source_id === 'string' ? record.source_id : '',
    targetType: parseTargetType(record.target_type),
    targetId: typeof record.target_id === 'string' ? record.target_id : '',
    field: typeof record.field === 'string' ? record.field : '',
    oldValue: typeof record.old_value === 'string' ? record.old_value : '',
    newValue: typeof record.new_value === 'string' ? record.new_value : '',
    rationale: typeof record.rationale === 'string' ? record.rationale : '',
    status: parseStatus(record.status),
    appliedAt,
    created: typeof record.created === 'string' ? record.created : appliedAt
  }
}

export function creativeDecisionInputToPbFields (input: {
  ownerId: string
  projectId: string
  actorType: string
  actorId: string
  decision: CreativeDecisionCreateInput
}): Record<string, unknown> {
  const now = new Date().toISOString()
  return {
    owned_by: input.ownerId,
    project: input.projectId,
    actor_type: input.actorType,
    actor_id: input.actorId,
    source_type: input.decision.sourceType,
    source_id: input.decision.sourceId || '',
    target_type: input.decision.targetType,
    target_id: input.decision.targetId,
    field: input.decision.field,
    old_value: input.decision.oldValue ?? '',
    new_value: input.decision.newValue,
    rationale: input.decision.rationale ?? '',
    status: input.decision.status ?? 'applied',
    applied_at: now
  }
}
