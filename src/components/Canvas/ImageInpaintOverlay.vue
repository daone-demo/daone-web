<template>
  <div class="image-inpaint-overlay" @mousedown.stop>
    <div class="image-inpaint-overlay__toolbar">
      <button type="button" class="image-inpaint-overlay__btn" @click="emit('cancel')">
        <span class="image-inpaint-overlay__icon image-inpaint-overlay__icon--close" aria-hidden="true" />
        取消
      </button>

      <div class="image-inpaint-overlay__tools">
        <button
          type="button"
          class="image-inpaint-overlay__icon-btn"
          title="撤销"
          :disabled="!canUndo"
          @click="undo"
        >
          <span class="image-inpaint-overlay__icon image-inpaint-overlay__icon--undo" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="image-inpaint-overlay__icon-btn"
          title="重做"
          :disabled="!canRedo"
          @click="redo"
        >
          <span class="image-inpaint-overlay__icon image-inpaint-overlay__icon--redo" aria-hidden="true" />
        </button>

        <div class="image-inpaint-overlay__brush">
          <button
            type="button"
            class="image-inpaint-overlay__btn image-inpaint-overlay__btn--brush"
            :class="{ 'image-inpaint-overlay__btn--active': showBrushPanel }"
            @click="showBrushPanel = !showBrushPanel"
          >
            <span class="image-inpaint-overlay__icon image-inpaint-overlay__icon--brush" aria-hidden="true" />
            画笔
          </button>
          <div v-if="showBrushPanel" class="image-inpaint-overlay__brush-panel">
            <span class="image-inpaint-overlay__brush-label">大小</span>
            <input
              v-model.number="brushSize"
              class="image-inpaint-overlay__brush-slider"
              type="range"
              min="8"
              max="120"
              @mousedown.stop
            />
          </div>
        </div>

        <button type="button" class="image-inpaint-overlay__btn" :disabled="!canUndo" @click="clearStrokes">
          <span class="image-inpaint-overlay__icon image-inpaint-overlay__icon--clear" aria-hidden="true" />
          清空
        </button>
      </div>

      <button
        type="button"
        class="image-inpaint-overlay__btn image-inpaint-overlay__btn--done"
        :disabled="completing"
        @click.stop="handleComplete"
      >
        <span class="image-inpaint-overlay__icon image-inpaint-overlay__icon--check" aria-hidden="true" />
        {{ completing ? '处理中...' : '完成' }}
      </button>
    </div>

    <div
      ref="stageRef"
      class="image-inpaint-overlay__stage"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
    >
      <div class="image-inpaint-overlay__image-wrap" :style="imageWrapStyle">
        <img
          :src="imageUrl"
          class="image-inpaint-overlay__image"
          draggable="false"
          alt=""
        />
        <canvas ref="displayCanvasRef" class="image-inpaint-overlay__canvas" />
      </div>

      <div ref="cursorRef" class="image-inpaint-overlay__cursor" aria-hidden="true" />
    </div>

    <div class="image-inpaint-overlay__prompt">
      <textarea
        v-model="prompt"
        class="image-inpaint-overlay__prompt-input"
        rows="2"
        placeholder="描述你想要修改的内容，例如：把衣服换成红色"
        @mousedown.stop
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { message } from 'ant-design-vue'
import {
  drawEraseDot,
  drawEraseSegment,
  exportEraseMask,
  getEraseImageBounds,
  redrawEraseDisplayCanvas,
  type ErasePoint,
  type EraseStroke,
} from './eraseUtils'

const props = defineProps<{
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
}>()

const emit = defineEmits<{
  cancel: []
  complete: [payload: {
    prompt: string
    mask: { dataUrl: string; width: number; height: number }
  }]
}>()

const stageRef = ref<HTMLElement | null>(null)
const displayCanvasRef = ref<HTMLCanvasElement | null>(null)
const cursorRef = ref<HTMLElement | null>(null)
const stageSize = ref({ width: 360, height: 320 })
const brushSize = ref(10)
const showBrushPanel = ref(false)
const completing = ref(false)
const prompt = ref('')

const strokes = shallowRef<EraseStroke[]>([])
const redoStack = shallowRef<EraseStroke[]>([])

let drawing = false
let activePointerId: number | null = null
let currentStroke: EraseStroke | null = null
let paintCtx: CanvasRenderingContext2D | null = null
let rafId = 0
let pendingPointer: { x: number; y: number } | null = null

const imageBounds = computed(() =>
  getEraseImageBounds(
    stageSize.value.width,
    stageSize.value.height,
    props.naturalWidth,
    props.naturalHeight,
  ),
)

const imageWrapStyle = computed(() => ({
  left: `${imageBounds.value.x}px`,
  top: `${imageBounds.value.y}px`,
  width: `${imageBounds.value.width}px`,
  height: `${imageBounds.value.height}px`,
}))

const canUndo = computed(() => strokes.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)

function getBounds() {
  return imageBounds.value
}

function getPaintContext() {
  const canvas = displayCanvasRef.value
  if (!canvas) return null
  if (!paintCtx || paintCtx.canvas !== canvas) {
    paintCtx = canvas.getContext('2d', { alpha: true })
  }
  return paintCtx
}

function refreshDisplayCanvas() {
  const canvas = displayCanvasRef.value
  if (!canvas) return
  redrawEraseDisplayCanvas(canvas, strokes.value, getBounds())
}

function commitStrokeLists(nextStrokes: EraseStroke[], nextRedo: EraseStroke[] = []) {
  strokes.value = nextStrokes
  redoStack.value = nextRedo
}

function undo() {
  if (!strokes.value.length) return
  const nextStrokes = strokes.value.slice(0, -1)
  const nextRedo = [...redoStack.value, strokes.value[strokes.value.length - 1]]
  commitStrokeLists(nextStrokes, nextRedo)
  refreshDisplayCanvas()
}

function redo() {
  if (!redoStack.value.length) return
  const restored = redoStack.value[redoStack.value.length - 1]
  commitStrokeLists([...strokes.value, restored], redoStack.value.slice(0, -1))
  refreshDisplayCanvas()
}

function clearStrokes() {
  currentStroke = null
  commitStrokeLists([], [])
  refreshDisplayCanvas()
}

function isInsideImageBounds(x: number, y: number) {
  const bounds = getBounds()
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  )
}

function updateCursor(x: number, y: number, visible: boolean) {
  const cursor = cursorRef.value
  if (!cursor) return
  cursor.style.display = visible ? 'block' : 'none'
  cursor.style.width = `${brushSize.value}px`
  cursor.style.height = `${brushSize.value}px`
  cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
}

function paintPointerPoint(point: ErasePoint) {
  const ctx = getPaintContext()
  if (!ctx || !currentStroke) return
  drawEraseDot(ctx, point, currentStroke.size, getBounds())
}

function paintPointerSegment(from: ErasePoint, to: ErasePoint) {
  const ctx = getPaintContext()
  if (!ctx || !currentStroke) return
  drawEraseSegment(ctx, from, to, currentStroke.size, getBounds())
}

function processPointerPoint(x: number, y: number) {
  updateCursor(x, y, isInsideImageBounds(x, y))

  if (!drawing || !currentStroke) return

  const points = currentStroke.points
  const last = points[points.length - 1]
  const dx = x - last.x
  const dy = y - last.y
  if (dx * dx + dy * dy < 1) return

  const next = { x, y }
  if (points.length === 1) {
    paintPointerPoint(next)
  } else {
    paintPointerSegment(last, next)
  }
  points.push(next)
}

function schedulePointerPoint(x: number, y: number) {
  pendingPointer = { x, y }
  if (rafId) return
  rafId = window.requestAnimationFrame(() => {
    rafId = 0
    if (!pendingPointer) return
    const { x: nextX, y: nextY } = pendingPointer
    pendingPointer = null
    processPointerPoint(nextX, nextY)
  })
}

function getStagePoint(event: PointerEvent) {
  const rect = stageRef.value?.getBoundingClientRect()
  if (!rect) return null
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const point = getStagePoint(event)
  if (!point || !isInsideImageBounds(point.x, point.y)) return

  event.preventDefault()
  stageRef.value?.setPointerCapture(event.pointerId)
  activePointerId = event.pointerId
  drawing = true
  redoStack.value = []
  currentStroke = {
    points: [{ x: point.x, y: point.y }],
    size: brushSize.value,
  }
  paintPointerPoint(point)
}

function onPointerMove(event: PointerEvent) {
  const point = getStagePoint(event)
  if (!point) return

  if (activePointerId !== null && event.pointerId !== activePointerId) return
  schedulePointerPoint(point.x, point.y)
}

function onPointerUp(event?: PointerEvent) {
  if (event && activePointerId !== null && event.pointerId !== activePointerId) return

  if (rafId) {
    window.cancelAnimationFrame(rafId)
    rafId = 0
    if (pendingPointer) {
      processPointerPoint(pendingPointer.x, pendingPointer.y)
      pendingPointer = null
    }
  }

  if (!drawing || !currentStroke) return

  drawing = false
  activePointerId = null
  if (event) {
    stageRef.value?.releasePointerCapture(event.pointerId)
  }

  if (currentStroke.points.length >= 1) {
    commitStrokeLists([...strokes.value, currentStroke], redoStack.value)
  }
  currentStroke = null
}

function onPointerLeave(event: PointerEvent) {
  if (drawing) return
  const point = getStagePoint(event)
  if (!point) return
  updateCursor(point.x, point.y, false)
}

async function handleComplete() {
  const trimmedPrompt = prompt.value.trim()
  if (!trimmedPrompt) {
    message.warning('请输入修改描述')
    return
  }
  if (!strokes.value.length) {
    message.warning('请先涂抹要修改的区域')
    return
  }
  if (completing.value) return

  completing.value = true
  try {
    const mask = await exportEraseMask(
      strokes.value,
      getBounds(),
      props.naturalWidth,
      props.naturalHeight,
    )
    emit('complete', {
      prompt: trimmedPrompt,
      mask,
    })
  } catch (error) {
    message.error(error instanceof Error ? error.message : '局部修改处理失败，请稍后重试')
  } finally {
    completing.value = false
  }
}

function updateStageSize() {
  const rect = stageRef.value?.getBoundingClientRect()
  if (!rect) return
  stageSize.value = {
    width: rect.width,
    height: rect.height,
  }
  refreshDisplayCanvas()
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  updateCursor(0, 0, false)
  updateStageSize()
  if (stageRef.value) {
    resizeObserver = new ResizeObserver(updateStageSize)
    resizeObserver.observe(stageRef.value)
  }
})

onBeforeUnmount(() => {
  if (rafId) {
    window.cancelAnimationFrame(rafId)
  }
  resizeObserver?.disconnect()
})
</script>

<style scoped lang="scss">
.image-inpaint-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.16);
  overflow: hidden;
}

.image-inpaint-overlay__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px 12px;
  border-bottom: 1px solid #eef0f3;
  background: #fff;
  flex-shrink: 0;
  overflow: visible;
}

.image-inpaint-overlay__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: #f3f4f6;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &--brush {
    border-radius: 999px;
  }

  &--active {
    background: #111827;
    color: #fff;

    &:hover {
      background: #111827;
    }

    .image-inpaint-overlay__icon--brush {
      filter: brightness(0) invert(1);
    }
  }

  &--done {
    margin-left: auto;
    padding: 6px 14px;
    border-radius: 999px;
    background: #2563eb;
    color: #fff;
    font-weight: 500;
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background: #1d4ed8;
    }

    &:disabled {
      opacity: 0.72;
      cursor: wait;
    }

    .image-inpaint-overlay__icon--check {
      filter: brightness(0) invert(1);
    }
  }
}

.image-inpaint-overlay__tools {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.image-inpaint-overlay__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #f3f4f6;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.image-inpaint-overlay__brush {
  position: relative;
}

.image-inpaint-overlay__brush-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 180px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.image-inpaint-overlay__brush-label {
  color: #6b7280;
  font-size: 12px;
  white-space: nowrap;
}

.image-inpaint-overlay__brush-slider {
  flex: 1;
  accent-color: #2563eb;
}

.image-inpaint-overlay__stage {
  position: relative;
  flex: 1;
  min-height: 220px;
  background-color: #eceff3;
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.55) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.55) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.55) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.55) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  cursor: none;
  overflow: hidden;
  touch-action: none;
}

.image-inpaint-overlay__image-wrap {
  position: absolute;
  overflow: hidden;
}

.image-inpaint-overlay__image,
.image-inpaint-overlay__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
}

.image-inpaint-overlay__image {
  object-fit: contain;
}

.image-inpaint-overlay__canvas {
  will-change: contents;
}

.image-inpaint-overlay__cursor {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  margin: 0;
  border: 2px solid rgba(17, 24, 39, 0.85);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9);
  pointer-events: none;
  will-change: transform, width, height;
}

.image-inpaint-overlay__prompt {
  flex-shrink: 0;
  padding: 10px 12px 12px;
  border-top: 1px solid #eef0f3;
  background: #fff;
}

.image-inpaint-overlay__prompt-input {
  width: 100%;
  min-height: 56px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f9fafb;
  color: #111827;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
  box-sizing: border-box;

  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    border-color: #93c5fd;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }
}

.image-inpaint-overlay__icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  background: currentColor;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;

  &--close {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z'/%3E%3C/svg%3E");
  }

  &--undo {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M12.5 8c-2.65 0-5.05 1.04-6.86 2.74L3 8v7h7l-2.62-2.62C8.86 11.28 10.59 10.5 12.5 10.5c3.31 0 6 2.69 6 6s-2.69 6-6 6h-1v2h1c4.42 0 8-3.58 8-8s-3.58-8-8-8z'/%3E%3C/svg%3E");
  }

  &--redo {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.42 0-8 3.58-8 8s3.58 8 8 8h1v-2h-1c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.91 0 3.64.78 4.89 2.04L14 15h7V8l-2.6 2.6z'/%3E%3C/svg%3E");
  }

  &--brush {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.04-1.34-1.34a1 1 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a1 1 0 0 0 0-1.41z'/%3E%3C/svg%3E");
  }

  &--clear {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'/%3E%3C/svg%3E");
  }

  &--check {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'%3E%3Cpath d='M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E");
  }
}
</style>
