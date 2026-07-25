<template>
  <div class="image-expand-overlay" @mousedown.stop>
    <div class="image-expand-overlay__toolbar">
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
        <div v-if="showRatioMenu" class="image-expand-overlay__ratio-menu">
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

    <div
      ref="workspaceRef"
      class="image-expand-overlay__workspace"
      @mousedown="onWorkspaceMouseDown"
    >
      <div class="image-expand-overlay__stage">
        <div
          class="image-expand-overlay__frame"
          :style="frameStyle"
          @mousedown.stop="startDrag('move-frame', $event)"
        >
          <span
            v-for="handle in handles"
            :key="handle"
            class="image-expand-overlay__handle"
            :class="`image-expand-overlay__handle--${handle}`"
            @mousedown.stop="startDrag(handle, $event)"
          />
        </div>

        <div
          class="image-expand-overlay__image-box"
          :style="imageBoxStyle"
          @mousedown.stop="startDrag('move-image', $event)"
        >
          <img
            :src="imageUrl"
            class="image-expand-overlay__image"
            draggable="false"
            alt=""
          />
        </div>

        <div class="image-expand-overlay__image-dash" :style="imageDashStyle" />

        <div class="image-expand-overlay__sizes">
          <span>{{ imageSizeLabel }}</span>
          <span>{{ frameSizeLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  IMAGE_EXPAND_ASPECT_RATIOS,
  formatDimensions,
  type ImageExpandAspectKey,
} from './constants'
import {
  clampExpandFrame,
  clampImageOffset,
  computeExpandNaturalMetrics,
  createExpandFrameFromImageCenter,
  getImageFitBounds,
  scaleRectAroundCenter,
  type ExpandRect,
} from './expandUtils'

const props = defineProps<{
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
}>()

const emit = defineEmits<{
  cancel: []
  complete: [
    payload: {
      targetWidth: number
      targetHeight: number
      imageX: number
      imageY: number
      imageWidth: number
      imageHeight: number
      aspectRatio?: string
    },
  ]
}>()

const workspaceRef = ref<HTMLElement | null>(null)
const workspaceSize = ref({ width: 360, height: 420 })
const aspectKey = ref<ImageExpandAspectKey>('original')
const showRatioMenu = ref(false)
const completing = ref(false)
const zoomPercent = ref(100)
const baseImageBounds = ref<ExpandRect>({ x: 0, y: 0, width: 100, height: 100 })
const imageBounds = ref<ExpandRect>({ x: 0, y: 0, width: 100, height: 100 })
const expandFrame = ref<ExpandRect>({ x: 0, y: 0, width: 100, height: 100 })

const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type Handle = (typeof handles)[number] | 'move-frame' | 'move-image'

let dragState: {
  handle: Handle
  startX: number
  startY: number
  startFrame: ExpandRect
  startImage: ExpandRect
} | null = null

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

const imageBoxStyle = computed(() => ({
  left: `${imageBounds.value.x}px`,
  top: `${imageBounds.value.y}px`,
  width: `${imageBounds.value.width}px`,
  height: `${imageBounds.value.height}px`,
}))

const imageDashStyle = computed(() => imageBoxStyle.value)

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
  const base = getImageFitBounds(
    workspaceSize.value.width,
    workspaceSize.value.height,
    props.naturalWidth,
    props.naturalHeight,
  )
  baseImageBounds.value = base
  imageBounds.value = { ...base }
  expandFrame.value = { ...base }
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
  expandFrame.value = createExpandFrameFromImageCenter(
    imageBounds.value,
    workspaceSize.value,
    currentRatio.value,
  )
}

function updateWorkspaceSize() {
  if (!workspaceRef.value) return
  workspaceSize.value = {
    width: workspaceRef.value.clientWidth,
    height: workspaceRef.value.clientHeight,
  }
  resetLayout()
}

function startDrag(handle: Handle, event: MouseEvent) {
  dragState = {
    handle,
    startX: event.clientX,
    startY: event.clientY,
    startFrame: { ...expandFrame.value },
    startImage: { ...imageBounds.value },
  }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onWorkspaceMouseDown(event: MouseEvent) {
  if (event.target !== workspaceRef.value) return
}

function onDragMove(event: MouseEvent) {
  if (!dragState) return

  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  const ratio = currentRatio.value

  if (dragState.handle === 'move-image') {
    const nextImage = {
      ...dragState.startImage,
      x: dragState.startImage.x + dx,
      y: dragState.startImage.y + dy,
    }
    imageBounds.value = clampImageOffset(nextImage, expandFrame.value, workspaceSize.value)
    return
  }

  if (dragState.handle === 'move-frame') {
    const nextFrame = {
      ...dragState.startFrame,
      x: dragState.startFrame.x + dx,
      y: dragState.startFrame.y + dy,
    }
    expandFrame.value = clampExpandFrame(
      nextFrame,
      imageBounds.value,
      workspaceSize.value,
      ratio,
    )
    imageBounds.value = clampImageOffset(imageBounds.value, expandFrame.value, workspaceSize.value)
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
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
}

function handleComplete() {
  if (completing.value) return
  completing.value = true
  try {
    const metrics = computeExpandNaturalMetrics(
      expandFrame.value,
      imageBounds.value,
      props.naturalWidth,
      props.naturalHeight,
    )
    const ratioItem = IMAGE_EXPAND_ASPECT_RATIOS.find((item) => item.key === aspectKey.value)
    emit('complete', {
      ...metrics,
      aspectRatio: ratioItem && ratioItem.key !== 'original' ? ratioItem.label : undefined,
    })
  } finally {
    completing.value = false
  }
}

watch(
  () => [props.naturalWidth, props.naturalHeight],
  () => resetLayout(),
)

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  updateWorkspaceSize()
  if (workspaceRef.value) {
    resizeObserver = new ResizeObserver(updateWorkspaceSize)
    resizeObserver.observe(workspaceRef.value)
  }
})

onBeforeUnmount(() => {
  onDragEnd()
  resizeObserver?.disconnect()
})
</script>

<style scoped lang="scss">
.image-expand-overlay {
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

.image-expand-overlay__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px 12px;
  border-bottom: 1px solid #eef0f3;
  background: #fff;
  flex-shrink: 0;
  position: relative;
  z-index: 20;
  overflow: visible;
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
  width: min(180px, 28vw);
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
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
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

.image-expand-overlay__workspace {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 280px;
  background-color: #eceff3;
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.55) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.55) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.55) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.55) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}

.image-expand-overlay__stage {
  position: relative;
  width: 100%;
  height: 100%;
}

.image-expand-overlay__frame {
  position: absolute;
  border: 2px solid #3b82f6;
  border-radius: 2px;
  box-sizing: border-box;
  cursor: move;
  z-index: 2;
}

.image-expand-overlay__image-box {
  position: absolute;
  z-index: 1;
  overflow: hidden;
  cursor: move;
}

.image-expand-overlay__image {
  width: 100%;
  height: 100%;
  object-fit: fill;
  display: block;
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
  right: 12px;
  bottom: 12px;
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
  background: currentColor;
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
