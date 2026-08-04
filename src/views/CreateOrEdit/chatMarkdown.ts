import { marked } from 'marked'

marked.setOptions({
  breaks: true,
  gfm: true,
})

export function renderChatMarkdown(source: string): string {
  const text = source.trim()
  if (!text) return ''
  return marked.parse(text) as string
}
