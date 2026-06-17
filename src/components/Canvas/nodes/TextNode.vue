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
      @mousedown.stop.prevent="removeSelf"
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
        @mousedown.stop.prevent="removeSelf"
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
      <div class="text-node__gen-pill">{{ genPillText }}</div>
    </div>

    <div
      v-else-if="data.mode === 'picker'"
      class="text-node__body text-node__body--picker"
      :class="{ 'text-node__body--img2prompt': data.textPickerTask === 'img2prompt' }"
    >
      <div class="text-node__hero-icon">
        <span />
        <span />
        <span />
        <span />
      </div>
      <template v-if="data.textPickerTask !== 'img2prompt'">
        <p class="text-node__try">尝试：</p>
        <button
          v-for="action in TEXT_PICKER_ACTIONS"
          :key="action.key"
          type="button"
          class="text-node__action"
          :class="{ 'text-node__action--active': data.textPickerTask === action.key }"
          @mousedown.stop
          @click="onAction(action.key)"
        >
          <span class="text-node__action-icon" :data-icon="action.icon" />
          {{ action.label }}
        </button>
      </template>
    </div>

    <div v-else class="text-node__body text-node__body--editor">
      <div
        ref="editorRef"
        class="text-node__editor"
        contenteditable="true"
        :data-placeholder="TEXT_EDITOR_PLACEHOLDER"
        @input="onEditorInput"
        @blur="onEditorBlur"
        @focus="onEditorFocus"
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
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Node } from '@antv/x6'
import {
  TEXT_EDITOR_PLACEHOLDER,
  TEXT_PICKER_ACTIONS,
  type CanvasNodeData,
  type TextFormatCommand,
} from '../constants'
import { createEmptyNodeData } from '../constants'
import type { CanvasGraph } from '../graph'
import { useNodeDelete } from './useNodeDelete'
import { useNodeConnect } from './useNodeConnect'
import { useCanvasBgTheme } from '../useCanvasBgTheme'
import type { TextEditorApi } from './useTextEditorRegistry'

const getNode = inject<() => Node>('getNode')!
const { isLightTheme } = useCanvasBgTheme()
const { removeSelf } = useNodeDelete()
const { onPlusPointerDown } = useNodeConnect()

const editorRef = ref<HTMLElement | null>(null)
const data = reactive<CanvasNodeData>({
  ...createEmptyNodeData(),
  kind: 'text',
  title: '文本节点',
})

const genPillText = computed(() => {
  const p = data.textGenProgress ?? 0
  return p < 1 ? '准备中...' : `生成中 ${p}%...`
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

function syncData(patch: Partial<CanvasNodeData> = {}) {
  Object.assign(data, patch)
  getNode().setData({ ...data })
  canvasGraph().__notifyTextNodeUpdated?.()
}

function syncEditorHtml() {
  const el = editorRef.value
  if (!el) return
  const html = data.content || ''
  if (el.innerHTML !== html) {
    el.innerHTML = html
  }
}

function onEditorInput() {
  const el = editorRef.value
  if (!el) return
  data.content = el.innerHTML
  getNode().setData({ ...data })
}

function onEditorFocus() {
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
    }
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onEditorBlur() {
  onEditorInput()
}

function applyInlineStyle(style: Record<string, string>) {
  const el = editorRef.value
  if (!el) return
  el.focus()
  const sel = window.getSelection()
  if (!sel) return

  let range: Range
  const active = sel.rangeCount ? sel.getRangeAt(0) : null
  if (!active || active.collapsed || !el.contains(active.commonAncestorContainer)) {
    // 无选区时作用于整个文本节点内容
    range = document.createRange()
    range.selectNodeContents(el)
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
      document.execCommand('bold')
      break
    case 'italic':
      document.execCommand('italic')
      break
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

onMounted(() => {
  const node = getNode()
  Object.assign(data, node.getData() as CanvasNodeData)
  syncEditorHtml()

  editorApi = {
    execFormat,
    copyContent,
    requestExpand: () => canvasGraph().__requestTextExpand?.(node.id),
    focus: focusEditor,
    getPlainText,
  }
  canvasGraph().__textEditorRegistry?.register(node.id, editorApi)

  node.on('change:data', ({ current }) => {
    Object.assign(data, current as CanvasNodeData)
    syncEditorHtml()
  })
})

onBeforeUnmount(() => {
  canvasGraph().__textEditorRegistry?.unregister(getNode().id)
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
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
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
  margin: 0 0 8px;
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

  &:hover,
  &--active {
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
