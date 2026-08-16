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
        class="image-inpaint-overlay__icon-btn"
        title="回到视图"
        :disabled="isDefaultView"
        @click="resetView"
      >
        <span class="image-inpaint-overlay__icon image-inpaint-overlay__icon--fit" aria-hidden="true" />
      </button>

      <div class="image-inpaint-overlay__zoom">
        <button
          type="button"
          class="image-inpaint-overlay__icon-btn"
          title="缩小"
          :disabled="viewScale <= MIN_VIEW_SCALE"
          @click="zoomOut"
        >
          <span class="image-inpaint-overlay__icon image-inpaint-overlay__icon--zoom-out" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="image-inpaint-overlay__icon-btn"
          title="放大"
          :disabled="viewScale >= MAX_VIEW_SCALE"
          @click="zoomIn"
        >
          <span class="image-inpaint-overlay__icon image-inpaint-overlay__icon--zoom-in" aria-hidden="true" />
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
      :class="{
        'image-inpaint-overlay__stage--panning': panning,
        'image-inpaint-overlay__stage--grab': spaceHeld || shiftHeld,
      }"
      @wheel.prevent="onStageWheel"
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

      <button
        v-if="isImageOutOfView"
        type="button"
        class="image-inpaint-overlay__recenter"
        @click.stop="recenterView"
        @pointerdown.stop
        @pointerup.stop
        @mousedown.stop
      >
        <span class="image-inpaint-overlay__icon image-inpaint-overlay__icon--fit" aria-hidden="true" />
        回到视图中心
      </button>
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
/** 样式：styles/canvas-image-inpaint.scss（随 Canvas 主包加载） */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  exportEraseMask,
  getEraseImageBounds,
  INPAINT_BRUSH_DISPLAY_COLOR,
  normalizedPointToStage,
  redrawEraseDisplayCanvas,
  stagePointToNormalized,
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
    /** 父级上传/提交结束后调用，用于失败时恢复按钮可点 */
    settle?: () => void
  }]
}>()

const MIN_VIEW_SCALE = 0.25
const MAX_VIEW_SCALE = 6
const ZOOM_STEP = 1.2
const ZOOM_SENSITIVITY = 0.0012

const stageRef = ref<HTMLElement | null>(null)
const displayCanvasRef = ref<HTMLCanvasElement | null>(null)
const cursorRef = ref<HTMLElement | null>(null)
const stageSize = ref({ width: 360, height: 320 })
const viewScale = ref(1)
const viewPan = ref({ x: 0, y: 0 })
const spaceHeld = ref(false)
const shiftHeld = ref(false)
const panning = ref(false)
const brushSize = ref(10)
const showBrushPanel = ref(false)
const completing = ref(false)
const prompt = ref('')

const strokes = shallowRef<EraseStroke[]>([])
const redoStack = shallowRef<EraseStroke[]>([])

let drawing = false
let activePointerId: number | null = null
let currentStroke: EraseStroke | null = null
let rafId = 0
let pendingPointer: { x: number; y: number } | null = null
let panPointerId: number | null = null
let panStart = { x: 0, y: 0 }
let panBase = { x: 0, y: 0 }

const baseImageBounds = computed(() =>
  getEraseImageBounds(
    stageSize.value.width,
    stageSize.value.height,
    props.naturalWidth,
    props.naturalHeight,
  ),
)

const imageBounds = computed(() => {
  const base = baseImageBounds.value
  const width = base.width * viewScale.value
  const height = base.height * viewScale.value
  const centerX = base.x + base.width / 2 + viewPan.value.x
  const centerY = base.y + base.height / 2 + viewPan.value.y
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  }
})

const imageWrapStyle = computed(() => ({
  left: `${imageBounds.value.x}px`,
  top: `${imageBounds.value.y}px`,
  width: `${imageBounds.value.width}px`,
  height: `${imageBounds.value.height}px`,
}))

const canUndo = computed(() => strokes.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)
const isDefaultView = computed(
  () =>
    Math.abs(viewScale.value - 1) < 0.001 &&
    Math.abs(viewPan.value.x) < 0.5 &&
    Math.abs(viewPan.value.y) < 0.5,
)

const isImageOutOfView = computed(() => {
  const bounds = imageBounds.value
  const stage = stageSize.value
  if (!bounds.width || !bounds.height || !stage.width || !stage.height) {
    return false
  }

  return (
    bounds.x + bounds.width <= 0 ||
    bounds.y + bounds.height <= 0 ||
    bounds.x >= stage.width ||
    bounds.y >= stage.height
  )
})

function recenterView() {
  viewPan.value = { x: 0, y: 0 }
  refreshDisplayCanvas()
}

function resetView() {
  viewScale.value = 1
  viewPan.value = { x: 0, y: 0 }
  refreshDisplayCanvas()
}

function clampViewScale(scale: number) {
  return Math.min(MAX_VIEW_SCALE, Math.max(MIN_VIEW_SCALE, scale))
}

function zoomAroundImageCenter(scaleFactor: number) {
  const nextScale = clampViewScale(viewScale.value * scaleFactor)
  if (nextScale === viewScale.value) return
  viewScale.value = nextScale
  refreshDisplayCanvas()
}

function zoomIn() {
  zoomAroundImageCenter(ZOOM_STEP)
}

function zoomOut() {
  zoomAroundImageCenter(1 / ZOOM_STEP)
}

function onStageWheel(event: WheelEvent) {
  const factor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY)
  zoomAroundImageCenter(factor)
}

function onWindowKeyDown(event: KeyboardEvent) {
  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault()
    spaceHeld.value = true
  }
  if (event.key === 'Shift') {
    shiftHeld.value = true
  }
}

function onWindowKeyUp(event: KeyboardEvent) {
  if (event.code === 'Space') {
    spaceHeld.value = false
    if (panning.value && panPointerId !== null) {
      panning.value = false
      panPointerId = null
    }
  }
  if (event.key === 'Shift') {
    shiftHeld.value = false
  }
}

function shouldPan(event: PointerEvent, point: { x: number; y: number }) {
  if (event.button === 1 || event.button === 2) return true
  if (spaceHeld.value || shiftHeld.value || event.shiftKey || event.altKey) return true
  if (event.button === 0 && !isInsideImageBounds(point.x, point.y)) return true
  return false
}

function startPan(event: PointerEvent) {
  event.preventDefault()
  stageRef.value?.setPointerCapture(event.pointerId)
  panPointerId = event.pointerId
  panning.value = true
  panStart = { x: event.clientX, y: event.clientY }
  panBase = { ...viewPan.value }
  updateCursor(0, 0, false)
}

function getBounds() {
  return imageBounds.value
}

function refreshDisplayCanvas() {
  const canvas = displayCanvasRef.value
  if (!canvas) return
  redrawEraseDisplayCanvas(
    canvas,
    strokes.value,
    getBounds(),
    currentStroke,
    INPAINT_BRUSH_DISPLAY_COLOR,
  )
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

function processPointerPoint(x: number, y: number) {
  if (panning.value || spaceHeld.value || shiftHeld.value) {
    updateCursor(x, y, false)
    return
  }

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
  points.push(next)
  refreshDisplayCanvas()
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

function getStagePoint(event: { clientX: number; clientY: number }) {
  const rect = stageRef.value?.getBoundingClientRect()
  if (!rect) return null
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, .image-inpaint-overlay__recenter')) return

  const point = getStagePoint(event)
  if (!point) return

  if (shouldPan(event, point)) {
    startPan(event)
    return
  }

  if (event.button !== 0) return
  if (!isInsideImageBounds(point.x, point.y)) return

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
  refreshDisplayCanvas()
}

function onPointerMove(event: PointerEvent) {
  const point = getStagePoint(event)
  if (!point) return

  if (panning.value && panPointerId === event.pointerId) {
    viewPan.value = {
      x: panBase.x + (event.clientX - panStart.x),
      y: panBase.y + (event.clientY - panStart.y),
    }
    refreshDisplayCanvas()
    updateCursor(point.x, point.y, false)
    return
  }

  if (activePointerId !== null && event.pointerId !== activePointerId) return
  schedulePointerPoint(point.x, point.y)
}

function onPointerUp(event?: PointerEvent) {
  if (event && panPointerId !== null && event.pointerId === panPointerId) {
    panning.value = false
    panPointerId = null
    stageRef.value?.releasePointerCapture(event.pointerId)
    return
  }

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
  refreshDisplayCanvas()
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
      settle: () => {
        completing.value = false
      },
    })
    // 成功发出后保持禁用，直到父级 settle（失败重试）或弹层关闭（提交成功）
  } catch (error) {
    message.error(error instanceof Error ? error.message : '局部修改处理失败，请稍后重试')
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

watch(imageBounds, () => {
  refreshDisplayCanvas()
})

onMounted(() => {
  updateCursor(0, 0, false)
  updateStageSize()
  window.addEventListener('keydown', onWindowKeyDown)
  window.addEventListener('keyup', onWindowKeyUp)
  if (stageRef.value) {
    resizeObserver = new ResizeObserver(updateStageSize)
    resizeObserver.observe(stageRef.value)
  }
})

onBeforeUnmount(() => {
  if (rafId) {
    window.cancelAnimationFrame(rafId)
  }
  window.removeEventListener('keydown', onWindowKeyDown)
  window.removeEventListener('keyup', onWindowKeyUp)
  resizeObserver?.disconnect()
})
</script>
