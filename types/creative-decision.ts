/** PocketBase `creative_decisions` — append-only creative decision log. */

export type CreativeDecisionTargetType = 'project' | 'director' | 'character'

export type CreativeDecisionStatus = 'applied' | 'rejected' | 'superseded'

export interface CreativeDecision {
  id: string
  projectId: string
  actorType: string
  actorId: string
  sourceType: string
  sourceId: string
  targetType: CreativeDecisionTargetType
  targetId: string
  field: string
  oldValue: string
  newValue: string
  rationale: string
  status: CreativeDecisionStatus
  appliedAt: string
  created: string
}

export interface CreativeDecisionCreateInput {
  sourceType: string
  sourceId?: string
  targetType: CreativeDecisionTargetType
  targetId: string
  field: string
  oldValue?: string
  newValue: string
  rationale?: string
  status?: CreativeDecisionStatus
}
