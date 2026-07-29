import type { ImageMarkBBox } from './constants'

/** 图片引用与标记 mention，如 `@图片1`、`@标记#id：耳环` */
export const PROMPT_MENTION_REGEX = /@(?:图片\d+|标记(?:#[^：\s]+)?：[^\s@]+)/g

export const PROMPT_MARK_MENTION_THUMB_CLASS = 'prompt-mark-mention__thumb'
export const PROMPT_MARK_MENTION_LABEL_CLASS = 'prompt-mark-mention__label'
export const PROMPT_MARK_MENTION_CHEVRON_CLASS = 'prompt-mark-mention__chevron'

export function buildImageMarkMentionToken(mark: { id: string; label: string }) {
  const label = mark.label.trim()
  return label ? `@标记#${mark.id}：${label}` : ''
}

export function isImageMarkMentionToken(token: string) {
  return token.startsWith('@标记')
}

export function parseImageMarkMentionToken(token: string) {
  const match = token.match(/^@标记(?:#([^：\s]+))?：(.+)$/)
  if (!match) return null
  return { markId: match[1] ?? '', label: match[2] }
}

export interface PromptMarkMentionMeta {
  label: string
  thumbStyle?: Record<string, string>
}

export function buildMarkMentionThumbStyle(options: {
  thumbUrl: string
  imageWidth: number
  imageHeight: number
  bbox?: ImageMarkBBox
}): Record<string, string> {
  const { thumbUrl, imageWidth, imageHeight, bbox } = options
  if (!thumbUrl) return {}

  const safeUrl = thumbUrl.replace(/"/g, '\\"')

  if (bbox && bbox.width > 0 && bbox.height > 0 && imageWidth > 0 && imageHeight > 0) {
    const sizeX = (imageWidth / bbox.width) * 100
    const sizeY = (imageHeight / bbox.height) * 100
    const posX = imageWidth > bbox.width
      ? (bbox.x / (imageWidth - bbox.width)) * 100
      : 0
    const posY = imageHeight > bbox.height
      ? (bbox.y / (imageHeight - bbox.height)) * 100
      : 0
    return {
      backgroundImage: `url("${safeUrl}")`,
      backgroundSize: `${sizeX}% ${sizeY}%`,
      backgroundPosition: `${posX}% ${posY}%`,
    }
  }

  return {
    backgroundImage: `url("${safeUrl}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
}

/**
 * 将画布提示词中的 `@图片N` 转为后端约定格式 `[Image N]`。
 * 例：`@图片1 模特拿着@图片2 杯子` → `[Image 1] 模特拿着[Image 2]杯子`
 */
export function toVideoApiPrompt(prompt: string): string {
  return String(prompt || '').replace(/@图片(\d+)/g, '[Image $1]')
}

/** 中文等 IME 组合输入过程中应暂停重绘 contenteditable，否则会打断输入 */
export function isInputComposing(event?: Event): boolean {
  return Boolean((event as InputEvent | KeyboardEvent | undefined)?.isComposing)
}

export function createPromptMentionApi(
  mentionClass: string,
  options?: {
    resolveMention?: (token: string) => PromptMarkMentionMeta | null
  },
) {
  const isMentionEl = (node: Node | null): node is HTMLElement =>
    node instanceof HTMLElement && node.classList.contains(mentionClass)

  function applyThumbStyle(el: HTMLElement, style?: Record<string, string>) {
    if (!style) return
    Object.assign(el.style, style)
  }

  function createMentionSpan(token: string) {
    const span = document.createElement('span')
    span.className = mentionClass
    span.contentEditable = 'false'
    span.dataset.mention = token

    if (isImageMarkMentionToken(token)) {
      const parsed = parseImageMarkMentionToken(token)
      const meta = options?.resolveMention?.(token)
      const label = meta?.label ?? parsed?.label ?? token

      span.classList.add(`${mentionClass}--mark`)

      const thumb = document.createElement('span')
      thumb.className = PROMPT_MARK_MENTION_THUMB_CLASS
      thumb.setAttribute('aria-hidden', 'true')
      applyThumbStyle(thumb, meta?.thumbStyle)

      const labelEl = document.createElement('span')
      labelEl.className = PROMPT_MARK_MENTION_LABEL_CLASS
      labelEl.textContent = label

      const chevron = document.createElement('span')
      chevron.className = PROMPT_MARK_MENTION_CHEVRON_CLASS
      chevron.setAttribute('aria-hidden', 'true')
      chevron.textContent = '›'

      span.append(thumb, labelEl, chevron)
      return span
    }

    span.textContent = token
    return span
  }

  function serializePromptEl(el: HTMLElement): string {
    let text = ''
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent ?? ''
        return
      }
      if (isMentionEl(node)) {
        text += node.dataset.mention ?? node.textContent ?? ''
        return
      }
      text += node.textContent ?? ''
    })
    return text
  }

  function renderPromptToEl(el: HTMLElement, text: string) {
    el.innerHTML = ''
    if (!text) return

    const regex = new RegExp(PROMPT_MENTION_REGEX.source, 'g')
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        el.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
      }
      el.appendChild(createMentionSpan(match[0]))
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      el.appendChild(document.createTextNode(text.slice(lastIndex)))
    }
  }

  function getPlainTextOffset(
    root: HTMLElement,
    target: Node,
    targetOffset: number,
  ): number {
    let offset = 0
    let found = false

    const walk = (node: Node): void => {
      if (found) return

      if (node === target) {
        if (node.nodeType === Node.TEXT_NODE) {
          offset += targetOffset
        }
        found = true
        return
      }

      if (node.nodeType === Node.TEXT_NODE) {
        offset += node.textContent?.length ?? 0
        return
      }

      if (isMentionEl(node)) {
        offset += (node.dataset.mention ?? node.textContent ?? '').length
        return
      }

      node.childNodes.forEach(walk)
    }

    root.childNodes.forEach(walk)
    return offset
  }

  function setPlainTextOffset(root: HTMLElement, offset: number) {
    const sel = window.getSelection()
    if (!sel) return

    let remaining = Math.max(0, offset)
    let placed = false

    const placeBefore = (node: Node) => {
      const range = document.createRange()
      range.setStartBefore(node)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      placed = true
    }

    const placeAfter = (node: Node) => {
      const range = document.createRange()
      range.setStartAfter(node)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      placed = true
    }

    const walk = (node: Node): void => {
      if (placed) return

      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.textContent?.length ?? 0
        if (remaining <= len) {
          const range = document.createRange()
          range.setStart(node, remaining)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
          placed = true
          return
        }
        remaining -= len
        return
      }

      if (isMentionEl(node)) {
        const len = (node.dataset.mention ?? node.textContent ?? '').length
        if (remaining === 0) {
          placeBefore(node)
          return
        }
        if (remaining <= len) {
          placeAfter(node)
          return
        }
        remaining -= len
        return
      }

      node.childNodes.forEach(walk)
    }

    root.childNodes.forEach(walk)

    if (!placed) {
      const range = document.createRange()
      range.selectNodeContents(root)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }

  function findMentionBeforeCursor(): HTMLElement | null {
    const sel = window.getSelection()
    if (!sel?.rangeCount || !sel.isCollapsed) return null

    const { startContainer, startOffset } = sel.getRangeAt(0)

    if (startContainer.nodeType === Node.TEXT_NODE) {
      if (startOffset > 0) return null
      if (isMentionEl(startContainer.previousSibling)) {
        return startContainer.previousSibling
      }
      return null
    }

    if (startContainer instanceof HTMLElement && startOffset > 0) {
      const prev = startContainer.childNodes[startOffset - 1]
      if (isMentionEl(prev)) return prev
    }

    return null
  }

  function findMentionAfterCursor(): HTMLElement | null {
    const sel = window.getSelection()
    if (!sel?.rangeCount || !sel.isCollapsed) return null

    const { startContainer, startOffset } = sel.getRangeAt(0)

    if (startContainer.nodeType === Node.TEXT_NODE) {
      const len = startContainer.textContent?.length ?? 0
      if (startOffset < len) return null
      if (isMentionEl(startContainer.nextSibling)) {
        return startContainer.nextSibling
      }
      return null
    }

    if (startContainer instanceof HTMLElement) {
      const next = startContainer.childNodes[startOffset]
      if (isMentionEl(next)) return next
    }

    return null
  }

  return {
    mentionClass,
    isMentionEl,
    createMentionSpan,
    serializePromptEl,
    renderPromptToEl,
    getPlainTextOffset,
    setPlainTextOffset,
    findMentionBeforeCursor,
    findMentionAfterCursor,
  }
}

export function needsSpaceBeforeMention(
  range: Range,
  root: HTMLElement,
  isMentionEl: (node: Node | null) => node is HTMLElement,
): boolean {
  const { startContainer, startOffset } = range
  let prev: Node | null = null

  if (startContainer === root && startOffset > 0) {
    prev = root.childNodes[startOffset - 1] ?? null
  } else if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
    prev = startContainer.previousSibling
  } else if (startContainer instanceof HTMLElement && startOffset > 0) {
    prev = startContainer.childNodes[startOffset - 1] ?? null
  }

  if (!prev) return false
  if (isMentionEl(prev)) return true
  if (prev.nodeType === Node.TEXT_NODE) {
    const text = prev.textContent ?? ''
    return text.length > 0 && !/\s$/.test(text)
  }
  return false
}
