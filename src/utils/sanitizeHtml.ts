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
