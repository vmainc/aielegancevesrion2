import type { ProjectMember } from '~/types/project-member'

export function pbRecordToProjectMember (row: Record<string, unknown>): ProjectMember {
  const user = row.user
  const email =
    typeof user === 'object' && user !== null && 'email' in user
      ? String((user as { email?: string }).email || '')
      : ''
  const name =
    typeof user === 'object' && user !== null && 'name' in user
      ? String((user as { name?: string }).name || '')
      : ''
  const userId =
    typeof user === 'string'
      ? user
      : typeof user === 'object' && user !== null && 'id' in user
        ? String((user as { id?: string }).id || '')
        : ''

  const project = row.project
  const projectId =
    typeof project === 'string'
      ? project
      : typeof project === 'object' && project !== null && 'id' in project
        ? String((project as { id?: string }).id || '')
        : ''

  return {
    id: String(row.id || ''),
    projectId,
    userId,
    email,
    name,
    role: 'member',
    invitedBy: typeof row.invited_by === 'string' ? row.invited_by : undefined,
    createdAt: String(row.created || '')
  }
}
