/** PocketBase conversation titles are taken from the first user question (no extra AI call). */
export const CONVERSATION_TITLE_MAX_CHARS = 70
export const CONVERSATION_TITLE_WORD_BREAK_MIN = 50

export function conversationTitleFromQuestion (question: string): string {
  const t = String(question || '').trim().replace(/\s+/g, ' ')
  if (!t) return 'New conversation'
  if (t.length <= CONVERSATION_TITLE_MAX_CHARS) return t

  const slice = t.slice(0, CONVERSATION_TITLE_MAX_CHARS)
  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace >= CONVERSATION_TITLE_WORD_BREAK_MIN) {
    return slice.slice(0, lastSpace)
  }
  return slice
}
