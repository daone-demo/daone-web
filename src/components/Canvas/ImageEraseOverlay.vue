<template>
  <div class="image-erase-overlay" @mousedown.stop>
    <div class="image-erase-overlay__toolbar">
      <button type="button" class="image-erase-overlay__btn" @click="emit('cancel')">
        <span class="image-erase-overlay__icon image-erase-overlay__icon--close" aria-hidden="true" />
        取消
      </button>

      <div class="image-erase-overlay__tools">
        <button
          type="button"
          class="image-erase-overlay__icon-btn"
          title="撤销"
          :disabled="!canUndo"
          @click="undo"
        >
          <span class="image-erase-overlay__icon image-erase-overlay__icon--undo" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="image-erase-overlay__icon-btn"
          title="重做"
          :disabled="!canRedo"
          @click="redo"
        >
          <span class="image-erase-overlay__icon image-erase-overlay__icon--redo" aria-hidden="true" />
        </button>

        <div class="image-erase-overlay__brush">
          <button
            type="button"
            class="image-erase-overlay__btn image-erase-overlay__btn--brush"
            :class="{ 'image-erase-overlay__btn--active': showBrushPanel }"
            @click="showBrushPanel = !showBrushPanel"
          >
            <span class="image-erase-overlay__icon image-erase-overlay__icon--brush" aria-hidden="true" />
            画笔
          </button>
          <div v-if="showBrushPanel" class="image-erase-overlay__brush-panel">
            <span class="image-erase-overlay__brush-label">大小</span>
            <input
              v-model.number="brushSize"
              class="image-erase-overlay__brush-slider"
              type="range"
              min="8"
              max="120"
              @mousedown.stop
            />
          </div>
        </div>

        <button type="button" class="image-erase-overlay__btn" :disabled="!canUndo" @click="clearStrokes">
          <span class="image-erase-overlay__icon image-erase-overlay__icon--clear" aria-hidden="true" />
          清空
        </button>
      </div>

      <button
        type="button"
        class="image-erase-overlay__btn image-erase-overlay__btn--done"
        :disabled="completing"
        @click.stop="handleComplete"
      >
        <span class="image-erase-overlay__icon image-erase-overlay__icon--check" aria-hidden="true" />
        {{ completing ? '处理中...' : '完成' }}
      </button>
    </div>

    <div
      ref="stageRef"
      class="image-erase-overlay__stage"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
    >
      <div class="image-erase-overlay__image-wrap" :style="imageWrapStyle">
        <img
          :src="imageUrl"
          class="image-erase-overlay__image"
          draggable="false"
          alt=""
        />
        <canvas ref="displayCanvasRef" class="image-erase-overlay__canvas" />
      </div>

      <div ref="cursorRef" class="image-erase-overlay__cursor" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
/** 样式：styles/canvas-image-erase.scss（随 Canvas 主包加载） */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { message } from 'ant-design-vue'
import {
  drawEraseDotLocal,
  drawEraseSegmentLocal,
  exportErasedImage,
  getEraseImageBounds,
  getStrokeDisplaySize,
  normalizedPointToDisplay,
  normalizedPointToStage,
  redrawEraseDisplayCanvas,
  stagePointToNormalized,
  type ErasePoint,
  type EraseStroke,
} from './eraseUtils'
import { loadDrawableImage } from './drawableImage'

const props = defineProps<{
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
}>()

const emit = defineEmits<{
  cancel: []
  complete: [payload: { dataUrl: string; width: number; height: number }]
}>()

const stageRef = ref<HTMLElement | null>(null)
const displayCanvasRef = ref<HTMLCanvasElement | null>(null)
const cursorRef = ref<HTMLElement | null>(null)
const stageSize = ref({ width: 360, height: 420 })
const brushSize = ref(10)
const showBrushPanel = ref(false)
const completing = ref(false)

const strokes = shallowRef<EraseStroke[]>([])
const redoStack = shallowRef<EraseStroke[]>([])

let drawing = false
let activePointerId: number | null = null
let currentStroke: EraseStroke | null = null
let paintCtx: CanvasRenderingContext2D | null = null
let sourceImage: HTMLImageElement | null = null
let sourceImageRevoke: (() => void) | undefined
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

function paintPointerPoint(normalized: ErasePoint) {
  const ctx = getPaintContext()
  if (!ctx || !currentStroke) return
  const bounds = getBounds()
  drawEraseDotLocal(
    ctx,
    normalizedPointToDisplay(normalized, bounds),
    getStrokeDisplaySize(currentStroke, bounds),
  )
}

function paintPointerSegment(from: ErasePoint, to: ErasePoint) {
  const ctx = getPaintContext()
  if (!ctx || !currentStroke) return
  const bounds = getBounds()
  drawEraseSegmentLocal(
    ctx,
    normalizedPointToDisplay(from, bounds),
    normalizedPointToDisplay(to, bounds),
    getStrokeDisplaySize(currentStroke, bounds),
  )
}

function processPointerPoint(x: number, y: number) {
  updateCursor(x, y, isInsideImageBounds(x, y))

  if (!drawing || !currentStroke) return

  const bounds = getBounds()
  const points = currentStroke.points
  const last = points[points.length - 1]
  const lastStage = normalizedPointToStage(last, bounds)
  const dx = x - lastStage.x
  const dy = y - lastStage.y
  if (dx * dx + dy * dy < 1) return

  const next = stagePointToNormalized({ x, y }, bounds)
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
  const bounds = getBounds()
  const normalized = stagePointToNormalized(point, bounds)
  currentStroke = {
    points: [normalized],
    sizeRatio: brushSize.value / bounds.width,
  }
  paintPointerPoint(normalized)
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
  if (!strokes.value.length) {
    message.warning('请先涂抹要擦除的区域')
    return
  }
  if (completing.value) return

  completing.value = true
  try {
    const payload = await exportErasedImage(
      props.imageUrl,
      strokes.value,
      getBounds(),
      props.naturalWidth,
      props.naturalHeight,
      sourceImage,
    )
    emit('complete', payload)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '擦除处理失败，请稍后重试')
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
  void loadDrawableImage(props.imageUrl)
    .then((loaded) => {
      sourceImage = loaded.img
      sourceImageRevoke = loaded.revoke
    })
    .catch(() => {
      sourceImage = null
      sourceImageRevoke = undefined
    })
})

onBeforeUnmount(() => {
  if (rafId) {
    window.cancelAnimationFrame(rafId)
  }
  sourceImageRevoke?.()
  resizeObserver?.disconnect()
})
</script>
