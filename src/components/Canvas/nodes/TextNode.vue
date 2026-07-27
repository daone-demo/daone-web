<template>
  <div
    class="text-node"
    :class="{
      'text-node--selected': data.isSelected,
      'text-node--light': isLightTheme,
      'text-node--picker-card': data.mode === 'picker',
      'text-node--editor': data.mode === 'editor',
      'text-node--loading': data.textGenState === 'loading',
    }"
    @pointerdown.capture="onNodeShellPointerDown"
  >
    <button
      type="button"
      class="node-port-plus"
      title="添加连线节点"
      @mousedown.stop="onPlusPointerDown"
    >
      +
    </button>

    <button
      v-if="data.mode === 'picker'"
      type="button"
      class="canvas-node__delete-float"
      title="删除节点"
      @pointerdown.stop.prevent="removeSelf"
    >
      ×
    </button>

    <div v-if="data.mode !== 'picker'" class="text-node__title canvas-node__meta">
      <span class="text-node__title-icon">T</span>
      <span class="text-node__title-text">{{ data.title }}</span>
      <button
        type="button"
        class="canvas-node__delete"
        title="删除节点"
        @pointerdown.stop.prevent="removeSelf"
      >
        ×
      </button>
    </div>

    <div
      v-if="data.textGenState === 'loading'"
      class="text-node__body text-node__body--loading"
    >
      <div class="text-node__skeleton text-node__skeleton--lg">
        <span v-for="n in 8" :key="n" />
      </div>
      <!-- <div class="text-node__gen-pill">{{ genPillText }}</div> -->
    </div>

    <div
      v-else-if="data.mode === 'picker'"
      class="text-node__body text-node__body--picker"
    >
      <div class="text-node__hero-icon">
        <span />
        <span />
        <span />
        <span />
      </div>
      <button
        type="button"
        class="text-node__action text-node__action--write"
        @mousedown.stop
        @click="onAction('write')"
      >
        <span class="text-node__action-icon" data-icon="doc" aria-hidden="true" />
        自己编写内容
      </button>

      <!-- <p class="text-node__try">尝试：</p> -->
      <button
        v-for="action in TEXT_PICKER_TRY_ACTIONS"
        :key="action.key"
        type="button"
        class="text-node__action"
        @mousedown.stop
        @click="onAction(action.key)"
      >
        <span class="text-node__action-icon" :data-icon="action.icon" />
        {{ action.label }}
      </button>
    </div>

    <div v-else class="text-node__body text-node__body--editor">
      <div
        ref="editorRef"
        class="text-node__editor"
        contenteditable="true"
        :data-placeholder="TEXT_EDITOR_PLACEHOLDER"
        @input="onEditorInput"
        @compositionstart="onEditorCompositionStart"
        @compositionend="onEditorCompositionEnd"
        @blur="onEditorBlur"
        @focus="onEditorFocus"
        @keyup="saveEditorSelection"
        @mouseup="saveEditorSelection"
        @mousedown="onEditorMouseDown"
        @pointerdown.stop
      />
      <span
        class="text-node__resize"
        title="拖拽调整大小"
        @mousedown.stop.prevent="onResizeStart"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Node } from '@antv/x6'
import {
  TEXT_EDITOR_PLACEHOLDER,
  TEXT_PICKER_TRY_ACTIONS,
  type CanvasNodeData,
  type TextFormatCommand,
} from '../constants'
import { createEmptyNodeData } from '../constants'
import type { CanvasGraph } from '../graph'
import { useNodeConnect } from './useNodeConnect'
import { useCanvasBgTheme } from '../useCanvasBgTheme'
import type { TextEditorApi } from './useTextEditorRegistry'
import { syncNodeViewData } from './syncNodeViewData'
import { VueShapeView } from '@antv/x6-vue-shape'

/**
 * 模块级一次性补丁：X6 的 vue-shape 默认会在 foreignObject 上按下时启动节点拖拽，
 * 从而把内部 <button> 的点击吞掉，导致删除/操作按钮“点了没反应”。
 * 这里让按钮、可编辑区上的按下不再触发 X6 拖拽。放在 TextNode 内，随该文件一起生效。
 */
const vsvProto = VueShapeView.prototype as unknown as {
  onMouseDown: (e: MouseEvent, x: number, y: number) => void
  __btnPatched?: boolean
}
if (!vsvProto.__btnPatched) {
  vsvProto.__btnPatched = true
  const originalOnMouseDown = vsvProto.onMouseDown
  vsvProto.onMouseDown = function patchedOnMouseDown(e: MouseEvent, x: number, y: number) {
    const target = e?.target as Element | null
    if (target) {
      const tag = target.tagName?.toLowerCase()
      if (
        tag === 'button' ||
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.closest(
          'button, [contenteditable="true"], .canvas-node__delete, .canvas-node__delete-float, .node-port-plus',
        )
      ) {
        return
      }
    }
    return originalOnMouseDown.call(this, e, x, y)
  }
}

const getNode = inject<() => Node>('getNode')!
const { isLightTheme } = useCanvasBgTheme()
const { onPlusPointerDown } = useNodeConnect()

/**
 * 删除当前文本节点：不依赖外部链路（可能被清理函数中断），
 * 优先走应用统一删除，最后强制 removeCell 兜底，保证一定删得掉。
 */
function removeSelf(event?: Event) {
  event?.preventDefault()
  event?.stopPropagation()

  const node = getNode()
  const nodeId = node.id
  const g = node.model?.graph as CanvasGraph | undefined
  // eslint-disable-next-line no-console
  // console.log('[delete] TextNode removeSelf', { nodeId, hasGraph: !!g })
  if (!g) return

  ;(document.activeElement as HTMLElement | null)?.blur?.()

  requestAnimationFrame(() => {
    const appDelete = g.__deleteCanvasNode
    if (typeof appDelete === 'function') {
      try {
        appDelete(nodeId)
      } catch (error) {
        console.error('[Canvas] __deleteCanvasNode failed, fallback to removeCell', error)
      }
    }
    const cell = g.getCellById(nodeId)
    // eslint-disable-next-line no-console
    // console.log('[delete] TextNode force removeCell', { nodeId, stillExists: !!cell })
    if (cell) g.removeCell(cell)
  })
}

const editorRef = ref<HTMLElement | null>(null)
const isEditorComposing = ref(false)
const data = reactive<CanvasNodeData>({
  ...createEmptyNodeData(),
  kind: 'text',
  title: '文本节点',
})

let resizeState: {
  startX: number
  startY: number
  startW: number
  startH: number
} | null = null

function canvasGraph(): CanvasGraph {
  return getNode().model?.graph as CanvasGraph
}

function focusNodeForToolbar() {
  canvasGraph()?.__focusCanvasNode?.(getNode().id)
}

function shouldIgnoreNodeShellEvent(target: EventTarget | null) {
  if (!(target instanceof Element)) return true
  return Boolean(
    target.closest(
      'button, [contenteditable="true"], .text-node__resize, .node-port-plus, .canvas-node__delete, .canvas-node__delete-float',
    ),
  )
}

function onNodeShellPointerDown(event: PointerEvent) {
  if (data.mode !== 'editor' || data.textGenState === 'loading') return
  if (event.button !== 0) return
  if (shouldIgnoreNodeShellEvent(event.target)) return
  focusNodeForToolbar()
}

function syncData(patch: Partial<CanvasNodeData> = {}) {
  Object.assign(data, patch)
  getNode().setData({ ...data })
  canvasGraph().__notifyTextNodeUpdated?.()
}

function syncEditorHtml() {
  if (isEditorComposing.value) return
  const el = editorRef.value
  if (!el) return
  const html = data.content || ''
  if (el.innerHTML !== html) {
    el.innerHTML = html
    normalizeItalicMarkup(el)
  }
}

/** loading → editor 时 contenteditable 尚未挂载，需等 DOM 更新后再写入 */
function syncEditorHtmlWhenReady() {
  if (data.textGenState === 'loading') return
  nextTick(() => {
    syncEditorHtml()
    // vue-shape / v-if 切换偶发再晚一帧才出 editor
    if (!editorRef.value && data.content) {
      requestAnimationFrame(() => syncEditorHtml())
    }
  })
}

function onEditorCompositionStart() {
  isEditorComposing.value = true
}

function onEditorCompositionEnd() {
  isEditorComposing.value = false
  onEditorInput()
}

function onEditorInput() {
  const el = editorRef.value
  if (!el) return
  data.content = el.innerHTML
  getNode().setData({ ...data })
}

function onEditorFocus() {
  canvasGraph().__onTextEditorFocus?.(getNode().id)
  canvasGraph().__textEditorRegistry?.get(getNode().id)?.focus()
}

function placeCaretAtPoint(clientX: number, clientY: number) {
  const docWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: globalThis.Node; offset: number } | null
  }

  let range: Range | null = null
  if (docWithCaret.caretRangeFromPoint) {
    range = docWithCaret.caretRangeFromPoint(clientX, clientY)
  } else if (docWithCaret.caretPositionFromPoint) {
    const pos = docWithCaret.caretPositionFromPoint(clientX, clientY)
    if (pos) {
      range = document.createRange()
      range.setStart(pos.offsetNode, pos.offset)
      range.collapse(true)
    }
  }

  if (range) {
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
}

/**
 * 编辑器区域：按下并拖动则移动整个节点，轻点（未移动）则进入文字编辑。
 * 已处于编辑（聚焦）状态时不拦截，保持正常的选词/定位光标行为。
 */
function onEditorMouseDown(event: MouseEvent) {
  focusNodeForToolbar()
  event.stopPropagation()

  const el = editorRef.value
  if (el && document.activeElement === el) return
  if (event.button !== 0) return

  event.preventDefault()

  const node = getNode()
  const g = canvasGraph()
  const startClientX = event.clientX
  const startClientY = event.clientY
  const startLocal = g.clientToLocal(startClientX, startClientY)
  const origin = node.getPosition()
  let moved = false

  const onMove = (moveEvent: MouseEvent) => {
    if (!moved && Math.hypot(moveEvent.clientX - startClientX, moveEvent.clientY - startClientY) < 4) {
      return
    }
    moved = true
    const point = g.clientToLocal(moveEvent.clientX, moveEvent.clientY)
    node.position(origin.x + (point.x - startLocal.x), origin.y + (point.y - startLocal.y))
    g.__notifyNodeDragMove?.()
  }

  const onUp = (upEvent: MouseEvent) => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    if (moved) {
      g.__notifyNodeDragEnd?.()
    } else {
      el?.focus()
      placeCaretAtPoint(upEvent.clientX, upEvent.clientY)
      canvasGraph().__onTextEditorFocus?.(node.id)
    }
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onEditorBlur() {
  onEditorInput()
}

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

function toCssProp(prop: string) {
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
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
      void copyContent()
      return
    case 'expand':
      canvasGraph().__requestTextExpand?.(getNode().id)
      return
    default:
      break
  }

  onEditorInput()
}

async function copyContent() {
  const text = editorRef.value?.innerText ?? ''
  if (!text.trim()) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // ignore clipboard errors
  }
}

function getPlainText() {
  return editorRef.value?.innerText ?? ''
}

function focusEditor() {
  editorRef.value?.focus()
}

function onResizeStart(event: MouseEvent) {
  const node = getNode()
  const { width, height } = node.getSize()
  resizeState = {
    startX: event.clientX,
    startY: event.clientY,
    startW: width,
    startH: height,
  }

  const onMove = (moveEvent: MouseEvent) => {
    if (!resizeState) return
    const scale = node.getData()?.viewScale ?? 1
    const dx = (moveEvent.clientX - resizeState.startX) / scale
    const dy = (moveEvent.clientY - resizeState.startY) / scale
    const nextW = Math.max(220, Math.round(resizeState.startW + dx))
    const nextH = Math.max(140, Math.round(resizeState.startH + dy))
    data.editorWidth = nextW
    data.editorHeight = nextH
    node.resize(nextW, nextH)
    node.setData({ ...data })
    canvasGraph().__notifyTextNodeUpdated?.()
  }

  const onUp = () => {
    resizeState = null
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onAction(key: string) {
  if (key === 'write') {
    data.mode = 'editor'
    data.promptBarPinned = false
    data.textPickerTask = 'write'
    syncData()
    canvasGraph().__onTextPickerAction?.('write', getNode().id)
    nextTickFocus()
    return
  }
  canvasGraph().__onTextPickerAction?.(key, getNode().id)
}

function nextTickFocus() {
  requestAnimationFrame(() => {
    syncEditorHtml()
    focusEditor()
  })
}

let editorApi: TextEditorApi | undefined
// 卸载时节点可能已从 graph 移除（cell.model 被置空），此时再访问
// canvasGraph() 会得到 undefined。挂载时缓存注册表与节点 id，保证卸载逻辑
// 始终安全、不会抛错——否则异常会中断 vue-shape 的卸载流程，导致节点 DOM
// 残留在画布上（“删除后仍然显示”）。
let editorRegistry: ReturnType<typeof canvasGraph>['__textEditorRegistry']
let nodeIdForCleanup = ''
let detachDataListener: (() => void) | undefined
let detachSelectionListener: (() => void) | undefined

onMounted(() => {
  const node = getNode()
  nodeIdForCleanup = node.id
  syncNodeViewData(data, node.getData() as CanvasNodeData)
  syncEditorHtmlWhenReady()

  editorApi = {
    execFormat,
    copyContent,
    requestExpand: () => canvasGraph()?.__requestTextExpand?.(node.id),
    focus: focusEditor,
    getPlainText,
  }
  editorRegistry = canvasGraph()?.__textEditorRegistry
  editorRegistry?.register(node.id, editorApi)

  const onDataChange = ({ current }: { current: unknown }) => {
    syncNodeViewData(data, current as CanvasNodeData)
    if (!isEditorComposing.value) {
      syncEditorHtmlWhenReady()
    }
  }
  node.on('change:data', onDataChange)
  detachDataListener = () => node.off('change:data', onDataChange)

  const onSelectionChange = () => saveEditorSelection()
  document.addEventListener('selectionchange', onSelectionChange)
  detachSelectionListener = () => document.removeEventListener('selectionchange', onSelectionChange)
})

watch(
  () => [data.textGenState, data.content] as const,
  () => {
    if (isEditorComposing.value) return
    syncEditorHtmlWhenReady()
  },
)

onBeforeUnmount(() => {
  detachDataListener?.()
  detachSelectionListener?.()
  editorRegistry?.unregister(nodeIdForCleanup)
})
</script>

<style scoped lang="scss">
@import './node-delete.scss';
@import './node-port-plus.scss';
@import './node-light-theme.scss';

.text-node {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, sans-serif;
  color: #f3f4f6;
  pointer-events: auto;
}

.text-node--picker-card {
  .text-node__body--picker {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
}

.text-node--editor {
  .text-node__body--editor {
    flex: 1;
    min-height: 0;
  }
}

.text-node__title {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #9ca3af;
  cursor: move;
}

.text-node__title-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #3d3d45;
  font-size: 10px;
  font-weight: 700;
  color: #d1d5db;
}

.text-node__title-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-node__body {
  height: 100%;
  border: 1px solid #4b4b55;
  border-radius: 14px;
  background: #1e1e22;
  overflow: hidden;
}

.text-node__body--picker {
  padding: 16px 12px 12px;
}

/* 图生提示词占位：仅有 hero 图标，居中显示 */
.text-node__body--picker.text-node__body--img2prompt {
  align-items: center;
  justify-content: center;

  .text-node__hero-icon {
    margin-bottom: 0;
  }
}

.text-node__skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 4px;

  span {
    display: block;
    height: 10px;
    border-radius: 6px;
    background: linear-gradient(90deg, #2a2a30 25%, #3d3d45 50%, #2a2a30 75%);
    background-size: 200% 100%;
    animation: text-node-shimmer 1.2s infinite;

    &:nth-child(1) { width: 88%; }
    &:nth-child(2) { width: 72%; }
    &:nth-child(3) { width: 80%; }
    &:nth-child(4) { width: 56%; }
  }
}

.text-node__body--loading {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 16px 40px;
}

.text-node__skeleton--lg {
  flex: 1;
  padding: 4px 0;
  gap: 12px;

  span {
    height: 12px;

    &:nth-child(odd) { width: 92%; }
    &:nth-child(even) { width: 78%; }
    &:nth-child(3n) { width: 64%; }
  }
}

.text-node__gen-pill {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  padding: 4px 14px;
  border: 1px solid #4b4b55;
  border-radius: 999px;
  background: #2a2a30;
  color: #d1d5db;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
}

@keyframes text-node-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.text-node__hero-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  margin-bottom: 12px;

  span {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: #6b7280;

    &:nth-child(1) { width: 36px; }
    &:nth-child(2) { width: 28px; }
    &:nth-child(3) { width: 32px; }
    &:nth-child(4) { width: 24px; }
  }
}

.text-node__try {
  margin: 10px 0 8px;
  font-size: 12px;
  color: #6b7280;
}

.text-node__action {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-bottom: 4px;
  padding: 8px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #e5e7eb;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #2a2a30;
  }
}

.text-node__action-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #3d3d45;
  flex-shrink: 0;

  &[data-icon='play']::after { content: '▶'; font-size: 10px; display: flex; justify-content: center; }
  &[data-icon='image']::after { content: '▣'; font-size: 10px; display: flex; justify-content: center; }
  &[data-icon='audio']::after { content: '♪'; font-size: 10px; display: flex; justify-content: center; }
  &[data-icon='doc']::after { content: '≡'; font-size: 10px; display: flex; justify-content: center; }
}

.text-node__body--editor {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.text-node__editor {
  flex: 1;
  min-height: 0;
  padding: 12px 14px 20px;
  overflow: auto;
  outline: none;
  color: #f3f4f6;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
  font-synthesis: weight style;

  &:empty::before {
    content: attr(data-placeholder);
    color: #6b7280;
    pointer-events: none;
  }

  :deep(h1) {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 700;
  }

  :deep(h2) {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 700;
  }

  :deep(h3) {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 600;
  }

  :deep(p) {
    margin: 0 0 6px;
  }

  :deep(i),
  :deep(em),
  :deep([data-canvas-italic='true']) {
    font-style: italic;
    font-synthesis: style;
  }

  :deep([style*='font-style: italic']),
  :deep([style*='font-style:italic']),
  :deep([style*='font-style: oblique']),
  :deep([style*='font-style:oblique']) {
    font-style: italic;
    font-synthesis: style;
  }

  :deep(b),
  :deep(strong) {
    font-weight: 700;
  }

  :deep([style*='font-style: normal']),
  :deep([style*='font-style:normal']) {
    font-style: normal !important;
  }

  :deep([style*='font-weight: 700']),
  :deep([style*='font-weight:700']),
  :deep([style*='font-weight: bold']),
  :deep([style*='font-weight:bold']) {
    font-weight: 700;
  }

  :deep([style*='font-weight: 400']),
  :deep([style*='font-weight:400']),
  :deep([style*='font-weight: normal']),
  :deep([style*='font-weight:normal']) {
    font-weight: 400;
  }

  :deep(ul),
  :deep(ol) {
    margin: 0 0 6px;
    padding-left: 20px;
  }

  :deep(hr) {
    margin: 8px 0;
    border: none;
    border-top: 1px solid #4b4b55;
  }
}

.text-node__resize {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
  opacity: 0.45;

  &::before {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    width: 10px;
    height: 10px;
    border-right: 2px solid #9ca3af;
    border-bottom: 2px solid #9ca3af;
  }
}
</style>
