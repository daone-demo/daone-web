<template>
  <div class="image-expand-overlay" @mousedown.stop>
    <div
      class="image-expand-overlay__workspace"
      :style="workspaceOffsetStyle"
    >
      <div
        class="image-expand-overlay__toolbar"
        :style="toolbarStyle"
        @mousedown.stop
      >
        <button type="button" class="image-expand-overlay__btn" @click="emit('cancel')">
          <span class="image-expand-overlay__icon image-expand-overlay__icon--close" aria-hidden="true" />
          取消
        </button>

        <div class="image-expand-overlay__zoom">
          <button
            type="button"
            class="image-expand-overlay__icon-btn"
            title="缩小"
            @click="adjustZoom(-0.05)"
          >
            −
          </button>
          <input
            v-model.number="zoomPercent"
            class="image-expand-overlay__zoom-slider"
            type="range"
            min="50"
            max="200"
            step="1"
            @input="onZoomInput"
          />
          <button
            type="button"
            class="image-expand-overlay__icon-btn"
            title="放大"
            @click="adjustZoom(0.05)"
          >
            +
          </button>
          <span class="image-expand-overlay__zoom-label">{{ zoomPercent }}%</span>
        </div>

        <div class="image-expand-overlay__ratio">
          <button
            type="button"
            class="image-expand-overlay__btn image-expand-overlay__btn--ratio"
            :class="{ 'image-expand-overlay__btn--active': showRatioMenu }"
            @click="showRatioMenu = !showRatioMenu"
          >
            <span class="image-expand-overlay__icon image-expand-overlay__icon--ratio" aria-hidden="true" />
            比例
          </button>
          <div
            v-if="showRatioMenu"
            class="image-expand-overlay__ratio-menu"
            @wheel.stop
            @mousedown.stop
          >
            <button
              v-for="item in IMAGE_EXPAND_ASPECT_RATIOS"
              :key="item.key"
              type="button"
              class="image-expand-overlay__ratio-item"
              :class="{ 'image-expand-overlay__ratio-item--active': aspectKey === item.key }"
              @click="selectAspect(item.key)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <button
          type="button"
          class="image-expand-overlay__btn image-expand-overlay__btn--done"
          :disabled="completing"
          @click.stop="handleComplete"
        >
          <span class="image-expand-overlay__icon image-expand-overlay__icon--check" aria-hidden="true" />
          {{ completing ? '提交中...' : '完成' }}
        </button>
      </div>

      <div class="image-expand-overlay__stage">
        <div
          class="image-expand-overlay__node"
          :class="{
            'image-expand-overlay__node--grab': !imageDragging,
            'image-expand-overlay__node--grabbing': imageDragging,
          }"
          :style="frameStyle"
          @mousedown.stop="onFrameMouseDown"
        >
          <div
            class="image-expand-overlay__image-box"
            :style="imageInnerStyle"
            @mousedown.stop="onImageMouseDown"
            @mouseenter="showImageDragHint = true"
            @mouseleave="showImageDragHint = false"
          >
            <img
              :src="imageUrl"
              class="image-expand-overlay__image"
              draggable="false"
              alt=""
            />
            <div
              v-if="showImageDragHint && !imageDragging"
              class="image-expand-overlay__drag-hint"
            >
              长按鼠标进行拖拽
            </div>
          </div>

          <div class="image-expand-overlay__image-dash" :style="imageInnerStyle" />

          <span
            v-for="handle in handles"
            :key="handle"
            class="image-expand-overlay__handle"
            :class="`image-expand-overlay__handle--${handle}`"
            @mousedown.stop="startDrag(handle, $event)"
          />
        </div>

        <div class="image-expand-overlay__sizes" :style="sizesStyle">
          <span>{{ imageSizeLabel }}</span>
          <span>{{ frameSizeLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  IMAGE_EXPAND_ASPECT_RATIOS,
  formatDimensions,
  type ImageExpandAspectKey,
} from './constants'
import {
  IMAGE_EXPAND_TOOLBAR_GAP,
  IMAGE_EXPAND_TOOLBAR_HEIGHT,
} from './graph'
import {
  clampExpandFrame,
  clampImageOffset,
  computeExpandNaturalMetrics,
  computeExpandRequestMetrics,
  createExpandFrameFromImageCenter,
  createInitialExpandFrame,
  type ExpandRect,
} from './expandUtils'

const LONG_PRESS_MS = 320
const LONG_PRESS_MOVE_CANCEL_PX = 6

const props = defineProps<{
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
  padX: number
  padY: number
  displayWidth: number
  displayHeight: number
}>()

const emit = defineEmits<{
  cancel: []
  complete: [
    payload: {
      expandDirection: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'ALL'
      expandRatio: number
    },
  ]
}>()

const workspaceSize = ref({ width: 100, height: 100 })
const aspectKey = ref<ImageExpandAspectKey>('original')
const showRatioMenu = ref(false)
const completing = ref(false)
const zoomPercent = ref(100)
const baseImageBounds = ref<ExpandRect>({ x: 0, y: 0, width: 100, height: 100 })
const imageBounds = ref<ExpandRect>({ x: 0, y: 0, width: 100, height: 100 })
const expandFrame = ref<ExpandRect>({ x: 0, y: 0, width: 100, height: 100 })

const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type Handle = (typeof handles)[number] | 'move-image'

const spaceHeld = ref(false)
const imageDragging = ref(false)
const showImageDragHint = ref(false)

let dragState: {
  handle: Handle
  startX: number
  startY: number
  startFrame: ExpandRect
  startImage: ExpandRect
} | null = null

let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressCleanup: (() => void) | null = null

const workspaceOffsetStyle = computed(() => ({
  paddingTop: `${IMAGE_EXPAND_TOOLBAR_HEIGHT + IMAGE_EXPAND_TOOLBAR_GAP}px`,
}))

const currentRatio = computed(() => {
  const item = IMAGE_EXPAND_ASPECT_RATIOS.find((entry) => entry.key === aspectKey.value)
  if (!item || item.ratio === null) return null
  if (item.ratio === 'original') {
    return props.naturalWidth / props.naturalHeight
  }
  return item.ratio
})

const frameStyle = computed(() => ({
  left: `${expandFrame.value.x}px`,
  top: `${expandFrame.value.y}px`,
  width: `${expandFrame.value.width}px`,
  height: `${expandFrame.value.height}px`,
}))

const imageInnerStyle = computed(() => ({
  left: `${imageBounds.value.x - expandFrame.value.x}px`,
  top: `${imageBounds.value.y - expandFrame.value.y}px`,
  width: `${imageBounds.value.width}px`,
  height: `${imageBounds.value.height}px`,
}))

const toolbarStyle = computed(() => {
  const centerX = expandFrame.value.x + expandFrame.value.width / 2
  const top = Math.max(0, expandFrame.value.y - IMAGE_EXPAND_TOOLBAR_GAP)
  return {
    left: `${centerX}px`,
    top: `${top}px`,
    transform: 'translate(-50%, -100%)',
  }
})

const sizesStyle = computed(() => ({
  left: `${expandFrame.value.x + expandFrame.value.width}px`,
  top: `${expandFrame.value.y + expandFrame.value.height + 6}px`,
  transform: 'translate(-100%, 0)',
}))

const imageSizeLabel = computed(() => {
  const metrics = computeExpandNaturalMetrics(
    expandFrame.value,
    imageBounds.value,
    props.naturalWidth,
    props.naturalHeight,
  )
  return formatDimensions(metrics.imageWidth, metrics.imageHeight) || '0 × 0'
})

const frameSizeLabel = computed(() => {
  const metrics = computeExpandNaturalMetrics(
    expandFrame.value,
    imageBounds.value,
    props.naturalWidth,
    props.naturalHeight,
  )
  return formatDimensions(metrics.targetWidth, metrics.targetHeight) || '0 × 0'
})

function resetLayout() {
  const width = Math.max(props.displayWidth, 40)
  const height = Math.max(props.displayHeight, 40)
  workspaceSize.value = {
    width: width + props.padX * 2,
    height: height + props.padY * 2,
  }
  const base = {
    x: props.padX,
    y: props.padY,
    width,
    height,
  }
  baseImageBounds.value = base
  imageBounds.value = { ...base }
  expandFrame.value =
    aspectKey.value === 'original'
      ? createInitialExpandFrame(base)
      : createExpandFrameFromImageCenter(base, workspaceSize.value, currentRatio.value)
  zoomPercent.value = 100
}

function applyZoom() {
  const scale = zoomPercent.value / 100
  const nextImage = scaleRectAroundCenter(baseImageBounds.value, scale)
  imageBounds.value = clampImageOffset(nextImage, expandFrame.value, workspaceSize.value)
  if (currentRatio.value) {
    expandFrame.value = createExpandFrameFromImageCenter(
      imageBounds.value,
      workspaceSize.value,
      currentRatio.value,
    )
    return
  }
  expandFrame.value = clampExpandFrame(
    expandFrame.value,
    imageBounds.value,
    workspaceSize.value,
    null,
  )
}

function scaleRectAroundCenter(rect: ExpandRect, scale: number): ExpandRect {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const width = rect.width * scale
  const height = rect.height * scale
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
  }
}

function adjustZoom(delta: number) {
  zoomPercent.value = Math.max(50, Math.min(200, Math.round(zoomPercent.value + delta * 100)))
  applyZoom()
}

function onZoomInput() {
  zoomPercent.value = Math.max(50, Math.min(200, Math.round(zoomPercent.value)))
  applyZoom()
}

function selectAspect(key: ImageExpandAspectKey) {
  aspectKey.value = key
  showRatioMenu.value = false
  expandFrame.value =
    key === 'original'
      ? createInitialExpandFrame(imageBounds.value)
      : createExpandFrameFromImageCenter(
          imageBounds.value,
          workspaceSize.value,
          currentRatio.value,
        )
}

function clearLongPressWatch() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  if (longPressCleanup) {
    longPressCleanup()
    longPressCleanup = null
  }
}

function startDrag(handle: Handle, event: MouseEvent) {
  clearLongPressWatch()
  dragState = {
    handle,
    startX: event.clientX,
    startY: event.clientY,
    startFrame: { ...expandFrame.value },
    startImage: { ...imageBounds.value },
  }
  if (handle === 'move-image') {
    imageDragging.value = true
  }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function startImageLongPressDrag(event: MouseEvent) {
  if (event.button !== 0) return
  event.preventDefault()

  if (spaceHeld.value) {
    startDrag('move-image', event)
    return
  }

  const startX = event.clientX
  const startY = event.clientY
  const startImage = { ...imageBounds.value }

  clearLongPressWatch()
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    if (longPressCleanup) {
      longPressCleanup()
      longPressCleanup = null
    }
    dragState = {
      handle: 'move-image',
      startX,
      startY,
      startFrame: { ...expandFrame.value },
      startImage,
    }
    imageDragging.value = true
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
  }, LONG_PRESS_MS)

  const onMove = (moveEvent: MouseEvent) => {
    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY
    if (dx * dx + dy * dy <= LONG_PRESS_MOVE_CANCEL_PX * LONG_PRESS_MOVE_CANCEL_PX) return
    clearLongPressWatch()
  }

  const onUp = () => {
    clearLongPressWatch()
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  longPressCleanup = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
}

function onImageMouseDown(event: MouseEvent) {
  showImageDragHint.value = false
  startImageLongPressDrag(event)
}

function onFrameMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.image-expand-overlay__handle, .image-expand-overlay__image-box')) return
  startImageLongPressDrag(event)
}

function onWindowKeyDown(event: KeyboardEvent) {
  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault()
    spaceHeld.value = true
  }
}

function onWindowKeyUp(event: KeyboardEvent) {
  if (event.code === 'Space') {
    spaceHeld.value = false
  }
}

function onDragMove(event: MouseEvent) {
  if (!dragState) return

  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  const ratio = currentRatio.value

  if (dragState.handle === 'move-image') {
    imageBounds.value = clampImageOffset(
      {
        ...dragState.startImage,
        x: dragState.startImage.x + dx,
        y: dragState.startImage.y + dy,
      },
      expandFrame.value,
      workspaceSize.value,
    )
    return
  }

  let nextFrame = { ...dragState.startFrame }

  switch (dragState.handle) {
    case 'nw':
      nextFrame.x += dx
      nextFrame.y += dy
      nextFrame.width -= dx
      nextFrame.height -= dy
      break
    case 'n':
      nextFrame.y += dy
      nextFrame.height -= dy
      break
    case 'ne':
      nextFrame.y += dy
      nextFrame.width += dx
      nextFrame.height -= dy
      break
    case 'e':
      nextFrame.width += dx
      break
    case 'se':
      nextFrame.width += dx
      nextFrame.height += dy
      break
    case 's':
      nextFrame.height += dy
      break
    case 'sw':
      nextFrame.x += dx
      nextFrame.width -= dx
      nextFrame.height += dy
      break
    case 'w':
      nextFrame.x += dx
      nextFrame.width -= dx
      break
  }

  if (ratio && ratio > 0) {
    if (['n', 's'].includes(dragState.handle)) {
      nextFrame.width = nextFrame.height * ratio
    } else if (['e', 'w'].includes(dragState.handle)) {
      nextFrame.height = nextFrame.width / ratio
    } else {
      nextFrame.height = nextFrame.width / ratio
    }
  }

  expandFrame.value = clampExpandFrame(
    nextFrame,
    imageBounds.value,
    workspaceSize.value,
    ratio,
  )
  imageBounds.value = clampImageOffset(imageBounds.value, expandFrame.value, workspaceSize.value)
}

function onDragEnd() {
  dragState = null
  imageDragging.value = false
  showImageDragHint.value = false
  clearLongPressWatch()
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
}

function handleComplete() {
  if (completing.value) return
  completing.value = true
  try {
    const metrics = computeExpandRequestMetrics(expandFrame.value, imageBounds.value)
    if (metrics.expandRatio <= 0) {
      message.warning('请调整扩图范围')
      return
    }
    emit('complete', metrics)
  } finally {
    completing.value = false
  }
}

watch(
  () => [props.naturalWidth, props.naturalHeight, props.displayWidth, props.displayHeight, props.padX, props.padY],
  () => resetLayout(),
)

onMounted(() => {
  resetLayout()
  window.addEventListener('keydown', onWindowKeyDown)
  window.addEventListener('keyup', onWindowKeyUp)
})

onBeforeUnmount(() => {
  onDragEnd()
  window.removeEventListener('keydown', onWindowKeyDown)
  window.removeEventListener('keyup', onWindowKeyUp)
})
</script>

<style scoped lang="scss">
.image-expand-overlay {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.image-expand-overlay__workspace {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  pointer-events: none;
}

.image-expand-overlay__toolbar {
  position: absolute;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.14);
  pointer-events: auto;
  white-space: nowrap;
}

.image-expand-overlay__btn {
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

  &:hover {
    background: #f3f4f6;
  }

  &--done {
    margin-left: auto;
    padding: 6px 14px;
    border-radius: 999px;
    background: #2563eb;
    color: #fff;
    font-weight: 500;

    &:hover:not(:disabled) {
      background: #1d4ed8;
    }

    &:disabled {
      opacity: 0.72;
      cursor: wait;
    }

    .image-expand-overlay__icon--check {
      filter: brightness(0) invert(1);
    }
  }

  &--active {
    background: #eef2ff;
  }
}

.image-expand-overlay__zoom {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  justify-content: center;
}

.image-expand-overlay__zoom-slider {
  width: min(160px, 24vw);
}

.image-expand-overlay__zoom-label {
  min-width: 42px;
  font-size: 12px;
  color: #6b7280;
  text-align: right;
}

.image-expand-overlay__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.image-expand-overlay__ratio {
  position: relative;
  z-index: 21;
}

.image-expand-overlay__ratio-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  min-width: 120px;
  max-height: min(280px, calc(100vh - 160px));
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  overflow-x: hidden;
  overflow-y: auto;
}

.image-expand-overlay__ratio-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 13px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }

  &--active {
    background: #eef2ff;
    color: #2563eb;
  }
}

.image-expand-overlay__stage {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.image-expand-overlay__node {
  position: absolute;
  border: 2px solid #3b82f6;
  border-radius: 2px;
  box-sizing: border-box;
  cursor: default;
  z-index: 2;
  pointer-events: auto;

  &--grab {
    cursor: grab;
  }

  &--grabbing {
    cursor: grabbing;

    .image-expand-overlay__image-box {
      cursor: grabbing;
    }
  }
  background-color: #eceff3;
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.55) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.55) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.55) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.55) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}

.image-expand-overlay__image-box {
  position: absolute;
  z-index: 1;
  overflow: hidden;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
}

.image-expand-overlay__image {
  width: 100%;
  height: 100%;
  object-fit: fill;
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.image-expand-overlay__drag-hint {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: rgba(15, 23, 42, 0.42);
  color: #fff;
  font-size: 13px;
  line-height: 1.45;
  text-align: center;
  pointer-events: none;
  user-select: none;
}

.image-expand-overlay__image-dash {
  position: absolute;
  border: 1px dashed #60a5fa;
  box-sizing: border-box;
  pointer-events: none;
  z-index: 3;
}

.image-expand-overlay__handle {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 2px solid #3b82f6;
  border-radius: 50%;
  background: #fff;
  box-sizing: border-box;
  z-index: 4;

  &--nw { left: -6px; top: -6px; cursor: nwse-resize; }
  &--n { left: 50%; top: -6px; transform: translateX(-50%); cursor: ns-resize; }
  &--ne { right: -6px; top: -6px; cursor: nesw-resize; }
  &--e { right: -6px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
  &--se { right: -6px; bottom: -6px; cursor: nwse-resize; }
  &--s { left: 50%; bottom: -6px; transform: translateX(-50%); cursor: ns-resize; }
  &--sw { left: -6px; bottom: -6px; cursor: nesw-resize; }
  &--w { left: -6px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
}

.image-expand-overlay__sizes {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
  pointer-events: none;
  z-index: 5;
}

.image-expand-overlay__icon {
  display: inline-block;
  width: 14px;
  height: 14px;
  background: #000000;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;

  &--close {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='black' d='M3.2 3.2 12.8 12.8M12.8 3.2 3.2 12.8' stroke='black' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E");
  }

  &--ratio {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='2.5' y='4.5' width='11' height='7' fill='none' stroke='black' stroke-width='1.2'/%3E%3Cpath d='M5 2.5h6M5 13.5h6' stroke='black' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E");
  }

  &--check {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' d='M3.5 8.2 6.7 11.4 12.5 4.8'/%3E%3C/svg%3E");
  }
}
</style>
