import DOMPurify from 'dompurify'

const MARKDOWN_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote',
  'strong', 'b', 'em', 'i', 'del',
  'code', 'pre',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

/** 清洗来自 AI、服务端或历史记录的 Markdown 渲染结果。 */
export function sanitizeMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: MARKDOWN_TAGS,
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
    ALLOW_DATA_ATTR: false,
  })
}

/** 清洗画布富文本；保留编辑器支持的内联格式，移除脚本和事件属性。 */
export function sanitizeRichTextHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'hr', 'div',
      'h1', 'h2', 'h3',
      'ul', 'ol', 'li',
      'strong', 'b', 'em', 'i', 'span',
    ],
    ALLOWED_ATTR: ['style', 'data-canvas-italic'],
  })
}

const NOTIFICATION_TAGS = [
  'p', 'br', 'hr', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col',
]

const NOTIFICATION_ATTR = [
  'href', 'src', 'alt', 'title', 'class',
  'width', 'height', 'colspan', 'rowspan', 'align',
  'target', 'rel',
]

const SAFE_URI =
  /^(?:(?:https?):|\/(?!\/)|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i

/** 清洗通知富文本（用户端展示 / 防御历史脏数据）。 */
export function sanitizeNotificationHtml(html: string): string {
  if (!html) return ''
  const hookName = 'afterSanitizeAttributes' as const
  const hook = (node: Element) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || ''
      if (href && !SAFE_URI.test(href)) {
        node.removeAttribute('href')
      }
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer nofollow')
    }
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') || ''
      if (!src || !/^https?:\/\//i.test(src)) {
        node.removeAttribute('src')
      }
    }
  }
  DOMPurify.addHook(hookName, hook)
  try {
    return DOMPurify.sanitize(String(html), {
      ALLOWED_TAGS: NOTIFICATION_TAGS,
      ALLOWED_ATTR: [...NOTIFICATION_ATTR, 'style'],
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: SAFE_URI,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'svg', 'math'],
    })
  } finally {
    DOMPurify.removeHook(hookName)
  }
}
