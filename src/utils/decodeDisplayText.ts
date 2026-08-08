/** 将接口或存储中的 HTML 实体 / Unicode 转义还原为可读文本 */
export function decodeDisplayText(value?: string | null): string {
  if (value == null) return ''
  let text = String(value).trim()
  if (!text) return ''

  if (/\\u[0-9a-fA-F]{4}/.test(text)) {
    text = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
  }

  if (!/&(?:#x?[0-9a-f]+|#\d+|amp|lt|gt|quot);/i.test(text)) {
    return text
  }

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = text
    const decoded = textarea.value.trim()
    if (decoded) return decoded
  }

  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
}
