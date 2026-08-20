import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { buildOpenRouterChatCompletionBody } from '~/server/utils/openrouter-chat-completion'

const VISION_MODEL = 'openai/gpt-4o'

/**
 * One vision pass so non–vision-capable models still get a text summary of the reference image.
 */
export async function analyzeConceptReferenceImageBrief (dataUrl: string): Promise<string> {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) return ''

  const body = buildOpenRouterChatCompletionBody({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Describe this reference image for a film/video concept team. Include: subjects and action, setting, color palette, lighting, mood, era/genre cues, wardrobe/props, and cinematic style (lens/framing feel). Be specific and visual — 120–220 words. Plain prose only, no JSON.'
          },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ],
    temperature: 0.35,
    max_tokens: 500
  })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aifilmstud.io',
      'X-Title': 'AI Film Studio Concept Reference'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) return ''
  try {
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return (j.choices?.[0]?.message?.content || '').trim().slice(0, 2500)
  } catch {
    return ''
  }
}
