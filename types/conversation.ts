export type ConversationMessageRole = 'user' | 'assistant' | 'system'

export type ConversationRecord = {
  id: string
  user: string
  title: string
  created: string
  updated: string
}

export type ConversationMessageRecord = {
  id: string
  conversation: string
  user: string
  role: ConversationMessageRole
  content: string
  model: string
  created: string
}

export type ConversationListItem = ConversationRecord & {
  preview: string
  model: string
}
