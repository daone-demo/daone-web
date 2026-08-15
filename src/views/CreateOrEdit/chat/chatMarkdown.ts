import { marked } from 'marked'
import { sanitizeMarkdownHtml } from '@/utils/sanitizeHtml'
import type { ChatMessage } from '../chatTypes'

marked.setOptions({ breaks: true, gfm: true })

export function renderMarkdown(source: string): string {
  const html = marked.parse(source || '', { async: false })
  return sanitizeMarkdownHtml(typeof html === 'string' ? html : '')
}

export function shouldAnimateTip(
  item: ChatMessage,
  isStreaming: boolean,
  isProcessing: boolean,
): boolean {
  if (!item.tip?.trim()) return false
  // agent_thinking：始终做海浪抖动；其它 tip 仅在流式/处理中时动画
  if (item.tipWave) return true
  return isStreaming || isProcessing
}

export function setMessageTip(message: ChatMessage, tip?: string, tipWave = false) {
  message.tip = tip
  message.tipWave = tip ? tipWave : undefined
}

export function splitTipSegments(text: string) {
  return Array.from(text).map((char) => ({
    char: char === ' ' ? '\u00A0' : char,
    isSpace: char === ' ',
  }))
}
