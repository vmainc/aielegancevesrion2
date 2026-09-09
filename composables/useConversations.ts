import { conversationTitleFromQuestion } from '~/lib/conversation-title'
import type {
  ConversationListItem,
  ConversationMessageRecord,
  ConversationMessageRole,
  ConversationRecord
} from '~/types/conversation'

function isMissingCollectionError (error: unknown): boolean {
  const err = error as { status?: number; message?: string }
  const msg = String(err?.message || '').toLowerCase()
  return err?.status === 404 || msg.includes('missing collection') || msg.includes("wasn't found")
}

function asConversation (row: Record<string, unknown>): ConversationRecord {
  return {
    id: String(row.id || ''),
    user: String(row.user || ''),
    title: String(row.title || 'Conversation'),
    created: String(row.created || ''),
    updated: String(row.updated || '')
  }
}

function asMessage (row: Record<string, unknown>): ConversationMessageRecord {
  const roleRaw = String(row.role || 'user')
  const role: ConversationMessageRole =
    roleRaw === 'assistant' || roleRaw === 'system' ? roleRaw : 'user'
  return {
    id: String(row.id || ''),
    conversation: String(row.conversation || ''),
    user: String(row.user || ''),
    role,
    content: String(row.content || ''),
    model: String(row.model || ''),
    created: String(row.created || '')
  }
}

export function useConversations () {
  const { getPocketBase, getUserId, isAuthenticated } = useAuth()

  function requireUserId (): string {
    const id = getUserId()
    if (!id) throw new Error('You must be signed in.')
    return id
  }

  async function listConversations (page = 1, perPage = 50): Promise<ConversationListItem[]> {
    if (!isAuthenticated.value) return []
    const pb = getPocketBase()
    const userId = requireUserId()
    try {
      const result = await pb.collection('conversations').getList(page, perPage, {
        filter: `user = "${userId}"`,
        sort: '-created'
      })
      const items = result.items.map((row) => asConversation(row as unknown as Record<string, unknown>))
      const withPreview: ConversationListItem[] = []
      for (const conv of items) {
        let preview = conv.title
        let model = ''
        try {
          const msgs = await pb.collection('messages').getList(1, 8, {
            filter: `conversation = "${conv.id}" && user = "${userId}"`,
            sort: 'created'
          })
          const parsed = msgs.items.map((row) => asMessage(row as unknown as Record<string, unknown>))
          const firstUser = parsed.find((m) => m.role === 'user')
          const lastAssistant = [...parsed].reverse().find((m) => m.role === 'assistant' && m.model)
          if (firstUser?.content) preview = firstUser.content.trim().replace(/\s+/g, ' ')
          if (lastAssistant?.model) model = lastAssistant.model
        } catch {
          /* preview optional */
        }
        withPreview.push({ ...conv, preview, model })
      }
      return withPreview
    } catch (error) {
      if (isMissingCollectionError(error)) return []
      throw error
    }
  }

  async function getConversation (id: string): Promise<ConversationRecord | null> {
    if (!isAuthenticated.value) return null
    const pb = getPocketBase()
    const userId = requireUserId()
    try {
      const row = await pb.collection('conversations').getOne(id)
      const conv = asConversation(row as unknown as Record<string, unknown>)
      if (conv.user !== userId) return null
      return conv
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 404 || status === 403 || isMissingCollectionError(error)) return null
      throw error
    }
  }

  async function listMessages (conversationId: string): Promise<ConversationMessageRecord[]> {
    if (!isAuthenticated.value) return []
    const pb = getPocketBase()
    const userId = requireUserId()
    const conv = await getConversation(conversationId)
    if (!conv) return []
    try {
      const rows = await pb.collection('messages').getFullList({
        filter: `conversation = "${conversationId}" && user = "${userId}"`,
        sort: 'created'
      })
      return rows.map((row) => asMessage(row as unknown as Record<string, unknown>))
    } catch (error) {
      if (isMissingCollectionError(error)) return []
      throw error
    }
  }

  async function createConversation (title: string): Promise<ConversationRecord> {
    const pb = getPocketBase()
    const userId = requireUserId()
    const row = await pb.collection('conversations').create({
      user: userId,
      title: conversationTitleFromQuestion(title)
    })
    return asConversation(row as unknown as Record<string, unknown>)
  }

  async function addMessage (input: {
    conversationId: string
    role: ConversationMessageRole
    content: string
    model?: string
  }): Promise<ConversationMessageRecord> {
    const pb = getPocketBase()
    const userId = requireUserId()
    const row = await pb.collection('messages').create({
      conversation: input.conversationId,
      user: userId,
      role: input.role,
      content: input.content.slice(0, 20000),
      model: input.model || ''
    })
    return asMessage(row as unknown as Record<string, unknown>)
  }

  async function deleteConversation (id: string): Promise<boolean> {
    if (!isAuthenticated.value) return false
    const pb = getPocketBase()
    const conv = await getConversation(id)
    if (!conv) return false
    await pb.collection('conversations').delete(id)
    return true
  }

  /**
   * Persist a Guide turn. Creates the conversation on the first user message.
   * Failures are swallowed by the caller so AI replies still show.
   */
  async function persistGuideTurn (opts: {
    conversationId: string | null | undefined
    titleSource: string
    role: ConversationMessageRole
    content: string
    model?: string
  }): Promise<string | null> {
    if (!isAuthenticated.value || !opts.content.trim()) return opts.conversationId || null
    let conversationId = opts.conversationId || null
    if (!conversationId) {
      const created = await createConversation(opts.titleSource || opts.content)
      conversationId = created.id
    }
    await addMessage({
      conversationId,
      role: opts.role,
      content: opts.content,
      model: opts.model
    })
    return conversationId
  }

  return {
    listConversations,
    getConversation,
    listMessages,
    createConversation,
    addMessage,
    deleteConversation,
    persistGuideTurn
  }
}
