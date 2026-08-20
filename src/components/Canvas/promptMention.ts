import type { ImageMarkBBox } from './constants'

/** 图片引用与标记 mention，如 `@图片1`、`@标记#id` */
export const PROMPT_MENTION_REGEX = /@(?:图片\d+|标记(?:#[^：\s@]+(?:：[^\s@]+)?|：[^\s@]+))/g

export const PROMPT_MARK_MENTION_THUMB_CLASS = 'prompt-mark-mention__thumb'
export const PROMPT_MARK_MENTION_LABEL_CLASS = 'prompt-mark-mention__label'
export const PROMPT_MARK_MENTION_CHEVRON_CLASS = 'prompt-mark-mention__chevron'

export function buildImageMarkMentionToken(mark: { id: string }) {
  return mark.id ? `@标记#${mark.id}` : ''
}

export function isImageMarkMentionToken(token: string) {
  return token.startsWith('@标记')
}

export function isImageRefMentionToken(token: string) {
  return /^@图片\d+$/.test(token)
}

export function parseImageRefMentionToken(token: string) {
  const match = token.match(/^@图片(\d+)$/)
  if (!match) return null
  return { index: Number(match[1]) }
}

export function parseImageMarkMentionToken(token: string) {
  const withId = token.match(/^@标记#([^：\s@]+)(?:：(.+))?$/)
  if (withId) return { markId: withId[1], label: withId[2] ?? '' }

  const legacy = token.match(/^@标记：(.+)$/)
  if (legacy) return { markId: '', label: legacy[1] }

  return null
}

/**
 * 检测光标前是否处于未完成的 `@` 提及输入（用于弹出选图菜单）。
 * 已完整匹配的 `@图片N` / `@标记…` 不算活跃查询。
 */
export function findActiveAtMentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  if (caret <= 0) return null
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)))
  const match = before.match(/@([^\s@]*)$/)
  if (!match || match.index === undefined) return null

  const raw = match[0]
  if (isImageRefMentionToken(raw) || isImageMarkMentionToken(raw)) return null

  return {
    start: match.index,
    query: match[1] ?? '',
  }
}

export interface PromptMarkMentionMeta {
  label: string
  markId?: string
  labelOptions?: string[]
  selectedLabelIndex?: number
  switchable?: boolean
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

/**
 * 删除第 removedIndex（1-based）张图后，从提示词中移除对应 `@图片N`，
 * 并将更大编号整体前移一位。
 */
export function removeImageRefMentionFromPrompt(prompt: string, removedIndex: number): string {
  const removed = Math.floor(Number(removedIndex))
  if (!Number.isFinite(removed) || removed < 1) return String(prompt ?? '')

  return String(prompt ?? '')
    .replace(/@图片(\d+)/g, (token, numStr: string) => {
      const n = Number(numStr)
      if (!Number.isFinite(n)) return token
      if (n === removed) return ''
      if (n > removed) return `@图片${n - 1}`
      return token
    })
    .replace(/ {2,}/g, ' ')
}

/** 清空全部 `@图片N` 引用 */
export function stripAllImageRefMentionsFromPrompt(prompt: string): string {
  return String(prompt ?? '')
    .replace(/@图片\d+/g, '')
    .replace(/ {2,}/g, ' ')
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

  function createRichMentionSpan(
    token: string,
    options: {
      variant: 'mark' | 'image'
      label: string
      switchable?: boolean
      markId?: string
      thumbStyle?: Record<string, string>
    },
  ) {
    const span = document.createElement('span')
    span.className = mentionClass
    span.contentEditable = 'false'
    span.dataset.mention = token
    span.classList.add(`${mentionClass}--${options.variant}`)
    if (options.variant === 'mark' && options.switchable) {
      span.classList.add(`${mentionClass}--mark-switchable`)
    }
    if (options.markId) span.dataset.markId = options.markId

    const thumb = document.createElement('span')
    thumb.className = PROMPT_MARK_MENTION_THUMB_CLASS
    thumb.setAttribute('aria-hidden', 'true')
    applyThumbStyle(thumb, options.thumbStyle)

    const labelEl = document.createElement('span')
    labelEl.className = PROMPT_MARK_MENTION_LABEL_CLASS
    labelEl.textContent = options.label

    span.append(thumb, labelEl)

    if (options.variant === 'mark' && options.switchable) {
      const chevron = document.createElement('span')
      chevron.className = PROMPT_MARK_MENTION_CHEVRON_CLASS
      chevron.setAttribute('aria-hidden', 'true')
      chevron.textContent = '›'
      span.append(chevron)
    }

    return span
  }

  function createMentionSpan(token: string) {
    if (isImageMarkMentionToken(token)) {
      const parsed = parseImageMarkMentionToken(token)
      const meta = options?.resolveMention?.(token)
      return createRichMentionSpan(token, {
        variant: 'mark',
        label: meta?.label ?? parsed?.label ?? token,
        switchable: Boolean(meta?.switchable),
        markId: parsed?.markId || meta?.markId,
        thumbStyle: meta?.thumbStyle,
      })
    }

    if (isImageRefMentionToken(token)) {
      const parsed = parseImageRefMentionToken(token)
      const meta = options?.resolveMention?.(token)
      if (meta) {
        return createRichMentionSpan(token, {
          variant: 'image',
          label: meta.label || (parsed ? `图片 ${parsed.index}` : token),
          thumbStyle: meta.thumbStyle,
        })
      }
    }

    const span = document.createElement('span')
    span.className = mentionClass
    span.contentEditable = 'false'
    span.dataset.mention = token
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

    const measureNode = (node: Node): number => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent?.length ?? 0
      }
      if (isMentionEl(node)) {
        return (node.dataset.mention ?? node.textContent ?? '').length
      }
      let total = 0
      node.childNodes.forEach((child) => {
        total += measureNode(child)
      })
      return total
    }

    const walk = (node: Node): void => {
      if (found) return

      if (node === target) {
        if (node.nodeType === Node.TEXT_NODE) {
          offset += Math.max(0, Math.min(targetOffset, node.textContent?.length ?? 0))
        } else {
          // 元素级选区：offset 是 childNodes 下标（光标夹在 mention/文本节点之间时很常见）
          const limit = Math.max(0, Math.min(targetOffset, node.childNodes.length))
          for (let i = 0; i < limit; i++) {
            offset += measureNode(node.childNodes[i]!)
          }
        }
        found = true
        return
      }

      if (node.nodeType === Node.TEXT_NODE) {
        offset += node.textContent?.length ?? 0
        return
      }

      if (isMentionEl(node)) {
        // contenteditable=false 的 mention：内部选区一律视为整段 token
        if (node.contains(target)) {
          offset += (node.dataset.mention ?? node.textContent ?? '').length
          found = true
          return
        }
        offset += (node.dataset.mention ?? node.textContent ?? '').length
        return
      }

      node.childNodes.forEach(walk)
    }

    walk(root)
    return offset
  }

  function setPlainTextOffset(root: HTMLElement, offset: number) {
    setPlainTextSelection(root, offset, offset)
  }

  /** 将纯文本起止偏移还原为 DOM Selection（支持非折叠选区） */
  function setPlainTextSelection(root: HTMLElement, start: number, end = start) {
    const sel = window.getSelection()
    if (!sel) return

    const resolve = (offset: number): { node: Node; offset: number } | null => {
      let remaining = Math.max(0, offset)
      let result: { node: Node; offset: number } | null = null

      const placeAtParent = (node: Node, after: boolean) => {
        const parent = node.parentNode
        if (!parent) return
        const index = Array.from(parent.childNodes).indexOf(node as ChildNode)
        if (index < 0) return
        result = { node: parent, offset: after ? index + 1 : index }
      }

      const walk = (node: Node): void => {
        if (result) return

        if (node.nodeType === Node.TEXT_NODE) {
          const len = node.textContent?.length ?? 0
          if (remaining <= len) {
            result = { node, offset: remaining }
            return
          }
          remaining -= len
          return
        }

        if (isMentionEl(node)) {
          const len = (node.dataset.mention ?? node.textContent ?? '').length
          if (remaining === 0) {
            placeAtParent(node, false)
            return
          }
          if (remaining <= len) {
            placeAtParent(node, true)
            return
          }
          remaining -= len
          return
        }

        node.childNodes.forEach(walk)
      }

      root.childNodes.forEach(walk)
      if (!result) {
        result = { node: root, offset: root.childNodes.length }
      }
      return result
    }

    const a = resolve(Math.min(start, end))
    const b = resolve(Math.max(start, end))
    if (!a || !b) return

    try {
      const range = document.createRange()
      range.setStart(a.node, a.offset)
      range.setEnd(b.node, b.offset)
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {
      const range = document.createRange()
      range.selectNodeContents(root)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }

  /** 读取当前选区在纯文本中的起止偏移；选区不在 root 内时返回 null */
  function getSelectionPlainOffsets(root: HTMLElement): { start: number; end: number } | null {
    const sel = window.getSelection()
    if (!sel?.rangeCount) return null
    const range = sel.getRangeAt(0)
    if (!root.contains(range.commonAncestorContainer)) return null
    const start = getPlainTextOffset(root, range.startContainer, range.startOffset)
    const end = getPlainTextOffset(root, range.endContainer, range.endOffset)
    return {
      start: Math.min(start, end),
      end: Math.max(start, end),
    }
  }

  /** 纯文本节点中仍含未转成 mention 的 @图片/@标记 时才需要重绘 */
  function needsMentionRerender(root: HTMLElement): boolean {
    let needs = false
    const walk = (node: Node): void => {
      if (needs) return
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? ''
        if (!text) return
        const regex = new RegExp(PROMPT_MENTION_REGEX.source, 'g')
        if (regex.test(text)) needs = true
        return
      }
      if (isMentionEl(node)) return
      node.childNodes.forEach(walk)
    }
    root.childNodes.forEach(walk)
    return needs
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
    setPlainTextSelection,
    getSelectionPlainOffsets,
    needsMentionRerender,
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

/**
 * 在纯文本偏移处插入 mention（含前后空格规则）。
 * 用字符串拼接代替 DOM Range，避免 contenteditable 失焦/focus 后选区乱跳。
 */
export function buildPromptWithMentionInsert(options: {
  text: string
  token: string
  start: number
  end?: number
}): { nextText: string; nextCaret: number } {
  const text = options.text ?? ''
  const token = options.token ?? ''
  const start = Math.max(0, Math.min(options.start, text.length))
  const end = Math.max(start, Math.min(options.end ?? start, text.length))
  const before = text.slice(0, start)
  const after = text.slice(end)
  const padBefore = before.length > 0 && !/[\s]$/.test(before) ? ' ' : ''
  const inserted = `${padBefore}${token} `
  return {
    nextText: `${before}${inserted}${after}`,
    nextCaret: before.length + inserted.length,
  }
}
