import type { Ref } from 'vue'
import type { TextFormatCommand } from '../constants'

export function useTextRichFormat(options: {
  editorRef: Ref<HTMLElement | null>
  onEditorInput: () => void
  onCopy?: () => void | Promise<void>
  onCut?: () => void | Promise<void>
  onPaste?: () => void | Promise<void>
  onExpand?: () => void
}) {
  const { editorRef, onEditorInput } = options
  let savedEditorRange: Range | null = null

  function saveEditorSelection() {
    const el = editorRef.value
    const sel = window.getSelection()
    if (!el || !sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    if (!el.contains(range.commonAncestorContainer)) return
    savedEditorRange = range.cloneRange()
  }

  function restoreEditorSelection() {
    const el = editorRef.value
    if (!el || !savedEditorRange) return false

    try {
      if (!el.contains(savedEditorRange.commonAncestorContainer)) return false
      const sel = window.getSelection()
      if (!sel) return false
      sel.removeAllRanges()
      sel.addRange(savedEditorRange)
      return true
    } catch {
      savedEditorRange = null
      return false
    }
  }

  function getFormatRange(): Range | null {
    const el = editorRef.value
    if (!el) return null

    restoreEditorSelection()
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      const active = sel.getRangeAt(0)
      if (el.contains(active.commonAncestorContainer) && !active.collapsed) {
        return active
      }
    }

    const range = document.createRange()
    range.selectNodeContents(el)
    return range
  }

  function isMarkActive(range: Range, kind: 'bold' | 'italic') {
    const el = editorRef.value
    if (!el) return false

    let current: globalThis.Node | null =
      range.startContainer.nodeType === globalThis.Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer

    while (current && current !== el) {
      if (current.nodeType !== globalThis.Node.ELEMENT_NODE) {
        current = (current as HTMLElement).parentElement
        continue
      }

      const html = current as HTMLElement
      const computed = window.getComputedStyle(html)

      if (kind === 'italic') {
        if (html.dataset.canvasItalic === 'true') return true
        if (html.tagName === 'I' || html.tagName === 'EM') return true
        if (html.style.fontStyle === 'normal') return false
        if (computed.fontStyle === 'italic' || computed.fontStyle === 'oblique') return true
      } else {
        if (html.tagName === 'B' || html.tagName === 'STRONG') return true
        if (html.style.fontWeight === 'normal' || html.style.fontWeight === '400') return false
        const weight = Number.parseInt(computed.fontWeight, 10)
        if (!Number.isNaN(weight) && weight >= 600) return true
      }

      current = html.parentElement
    }

    return false
  }

  function useSemanticInlineCommands() {
    try {
      document.execCommand('styleWithCSS', false, 'false')
    } catch {
      // ignore unsupported browsers
    }
  }

  function wrapRangeWithElement(range: Range, tagName: string) {
    const wrapper = document.createElement(tagName)
    wrapper.dataset.canvasItalic = 'true'
    try {
      range.surroundContents(wrapper)
    } catch {
      const fragment = range.extractContents()
      wrapper.appendChild(fragment)
      range.insertNode(wrapper)
    }

    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    const next = document.createRange()
    next.selectNodeContents(wrapper)
    sel.addRange(next)
  }

  function unwrapItalicInRange(root: HTMLElement, range: Range) {
    const toUnwrap: HTMLElement[] = []

    root.querySelectorAll('em, i').forEach((node) => {
      if (!(node instanceof HTMLElement)) return
      if (!range.intersectsNode(node)) return
      toUnwrap.push(node)
    })

    root.querySelectorAll<HTMLElement>('span[style*="font-style"]').forEach((span) => {
      const style = span.style.fontStyle
      if (style !== 'italic' && style !== 'oblique') return
      if (!range.intersectsNode(span)) return
      toUnwrap.push(span)
    })

    toUnwrap.forEach((node) => {
      if (node.tagName === 'SPAN') {
        node.style.removeProperty('font-style')
        if (!node.style.cssText.trim() && node.attributes.length <= 1) {
          const parent = node.parentNode
          if (!parent) return
          while (node.firstChild) parent.insertBefore(node.firstChild, node)
          parent.removeChild(node)
        }
        return
      }

      const parent = node.parentNode
      if (!parent) return
      while (node.firstChild) parent.insertBefore(node.firstChild, node)
      parent.removeChild(node)
    })
  }

  function normalizeItalicMarkup(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>('span[style*="font-style"]').forEach((span) => {
      const style = span.style.fontStyle
      if (style !== 'italic' && style !== 'oblique') return

      const em = document.createElement('em')
      em.dataset.canvasItalic = 'true'
      span.style.removeProperty('font-style')

      if (!span.style.cssText.trim() && span.attributes.length <= 1) {
        while (span.firstChild) em.appendChild(span.firstChild)
        span.replaceWith(em)
        return
      }

      while (span.firstChild) em.appendChild(span.firstChild)
      span.appendChild(em)
    })
  }

  function toggleItalicMark() {
    const el = editorRef.value
    if (!el) return
    el.focus()
    restoreEditorSelection()

    const range = getFormatRange()
    if (!range) return

    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)

    if (isMarkActive(range, 'italic')) {
      useSemanticInlineCommands()
      const applied = document.execCommand('italic', false)
      if (!applied) {
        unwrapItalicInRange(el, range)
      }
      normalizeItalicMarkup(el)
      onEditorInput()
      return
    }

    useSemanticInlineCommands()
    const applied = document.execCommand('italic', false)
    if (!applied) {
      wrapRangeWithElement(range, 'em')
    } else {
      el.querySelectorAll('em, i').forEach((node) => {
        if (node instanceof HTMLElement) {
          node.dataset.canvasItalic = 'true'
        }
      })
    }

    normalizeItalicMarkup(el)
    onEditorInput()
  }

  function toggleMarkStyle(kind: 'bold' | 'italic') {
    if (kind === 'italic') {
      toggleItalicMark()
      return
    }

    const range = getFormatRange()
    if (!range) return

    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)

    applyInlineStyle({ fontWeight: isMarkActive(range, 'bold') ? '400' : '700' })
  }

  function toCssProp(prop: string) {
    return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
  }

  function applyInlineStyle(style: Record<string, string>) {
    const el = editorRef.value
    if (!el) return
    el.focus()
    restoreEditorSelection()
    const sel = window.getSelection()
    if (!sel) return

    let range: Range
    const active = sel.rangeCount ? sel.getRangeAt(0) : null
    if (!active || active.collapsed || !el.contains(active.commonAncestorContainer)) {
      const fallback = getFormatRange()
      if (!fallback) return
      range = fallback
    } else {
      range = active
    }

    const span = document.createElement('span')
    Object.entries(style).forEach(([prop, value]) => {
      span.style.setProperty(toCssProp(prop), value)
    })
    const frag = range.extractContents()
    span.appendChild(frag)
    range.insertNode(span)

    sel.removeAllRanges()
    const next = document.createRange()
    next.selectNodeContents(span)
    sel.addRange(next)
    onEditorInput()
  }

  function execFormat(cmd: TextFormatCommand, value?: string) {
    const el = editorRef.value
    if (!el) return
    el.focus()
    restoreEditorSelection()

    switch (cmd) {
      case 'clear':
        document.execCommand('removeFormat')
        break
      case 'color':
        if (value) applyInlineStyle({ color: value })
        return
      case 'clear-color':
        applyInlineStyle({ color: 'inherit' })
        return
      case 'fontFamily':
        if (value) applyInlineStyle({ fontFamily: value })
        return
      case 'fontWeight':
        if (value) applyInlineStyle({ fontWeight: value })
        return
      case 'fontSize':
        if (value) applyInlineStyle({ fontSize: `${value}px` })
        return
      case 'lineHeight':
        if (value) {
          el.style.lineHeight = value
          onEditorInput()
        }
        return
      case 'align':
        document.execCommand(
          value === 'center'
            ? 'justifyCenter'
            : value === 'right'
              ? 'justifyRight'
              : value === 'justify'
                ? 'justifyFull'
                : 'justifyLeft',
        )
        onEditorInput()
        return
      case 'h1':
        document.execCommand('formatBlock', false, 'h1')
        break
      case 'h2':
        document.execCommand('formatBlock', false, 'h2')
        break
      case 'h3':
        document.execCommand('formatBlock', false, 'h3')
        break
      case 'paragraph':
        document.execCommand('formatBlock', false, 'p')
        break
      case 'bold':
        toggleMarkStyle('bold')
        return
      case 'italic':
        toggleMarkStyle('italic')
        return
      case 'bullet':
        document.execCommand('insertUnorderedList')
        break
      case 'ordered':
        document.execCommand('insertOrderedList')
        break
      case 'hr':
        document.execCommand('insertHorizontalRule')
        break
      case 'copy':
        void options.onCopy?.()
        return
      case 'cut':
        void options.onCut?.()
        return
      case 'paste':
        void options.onPaste?.()
        return
      case 'expand':
        options.onExpand?.()
        return
      default:
        break
    }

    onEditorInput()
  }

  return {
    saveEditorSelection,
    restoreEditorSelection,
    getFormatRange,
    isMarkActive,
    wrapRangeWithElement,
    unwrapItalicInRange,
    normalizeItalicMarkup,
    toggleItalicMark,
    toggleMarkStyle,
    applyInlineStyle,
    toCssProp,
    execFormat,
  }
}
