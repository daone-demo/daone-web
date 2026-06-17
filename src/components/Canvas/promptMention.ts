export const PROMPT_MENTION_REGEX = /@图片\d+/g

export function createPromptMentionApi(mentionClass: string) {
  const isMentionEl = (node: Node | null): node is HTMLElement =>
    node instanceof HTMLElement && node.classList.contains(mentionClass)

  function createMentionSpan(token: string) {
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
