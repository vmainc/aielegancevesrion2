import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

export function renderAnswerMarkdown (source: string): string {
  return md.render(String(source || ''))
}
