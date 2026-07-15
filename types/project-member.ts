export type ProjectMemberRole = 'member'

export type ProjectMember = {
  id: string
  projectId: string
  userId: string
  email: string
  name: string
  role: ProjectMemberRole
  invitedBy?: string
  createdAt: string
}

export type ProjectAccessRole = 'owner' | ProjectMemberRole
