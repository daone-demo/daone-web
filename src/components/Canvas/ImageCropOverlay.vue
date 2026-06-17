<template>
  <div class="image-crop-overlay" @mousedown.stop>
    <div class="image-crop-overlay__toolbar">
      <button type="button" class="image-crop-overlay__btn" @click="emit('cancel')">
        <span class="image-crop-overlay__icon image-crop-overlay__icon--close" aria-hidden="true" />
        取消
      </button>

      <div class="image-crop-overlay__ratio">
        <button
          type="button"
          class="image-crop-overlay__btn image-crop-overlay__btn--ratio"
          :class="{ 'image-crop-overlay__btn--active': showRatioMenu }"
          @click="showRatioMenu = !showRatioMenu"
        >
          <span class="image-crop-overlay__icon image-crop-overlay__icon--crop" aria-hidden="true" />
          {{ currentRatioLabel }}
        </button>
        <div v-if="showRatioMenu" class="image-crop-overlay__ratio-menu">
          <button
            v-for="item in IMAGE_CROP_ASPECT_RATIOS"
            :key="item.key"
            type="button"
            class="image-crop-overlay__ratio-item"
            :class="{ 'image-crop-overlay__ratio-item--active': aspectKey === item.key }"
            @click="selectAspect(item.key)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="image-crop-overlay__tools">
        <button type="button" class="image-crop-overlay__icon-btn" title="逆时针旋转" @click="rotate(-90)">
          <span class="image-crop-overlay__icon image-crop-overlay__icon--rotate-left" aria-hidden="true" />
        </button>
        <button type="button" class="image-crop-overlay__icon-btn" title="顺时针旋转" @click="rotate(90)">
          <span class="image-crop-overlay__icon image-crop-overlay__icon--rotate-right" aria-hidden="true" />
        </button>
        <button type="button" class="image-crop-overlay__icon-btn" title="水平翻转" @click="flipX = !flipX">
          <span class="image-crop-overlay__icon image-crop-overlay__icon--flip-x" aria-hidden="true" />
        </button>
        <button type="button" class="image-crop-overlay__icon-btn" title="垂直翻转" @click="flipY = !flipY">
          <span class="image-crop-overlay__icon image-crop-overlay__icon--flip-y" aria-hidden="true" />
        </button>
        <button type="button" class="image-crop-overlay__icon-btn" title="重置" @click="resetTransform">
          <span class="image-crop-overlay__icon image-crop-overlay__icon--reset" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        class="image-crop-overlay__btn image-crop-overlay__btn--done"
        :disabled="completing"
        @click.stop="handleComplete"
      >
        <span class="image-crop-overlay__icon image-crop-overlay__icon--check" aria-hidden="true" />
        {{ completing ? '处理中...' : '完成' }}
      </button>
    </div>

    <div
      ref="workspaceRef"
      class="image-crop-overlay__workspace"
      @mousedown="onWorkspaceMouseDown"
    >
      <div class="image-crop-overlay__stage">
        <div class="image-crop-overlay__image-wrap" :style="imageWrapStyle">
          <img
            :src="imageUrl"
            class="image-crop-overlay__image"
            :style="imageTransformStyle"
            draggable="false"
            alt=""
          />
        </div>

        <div class="image-crop-overlay__mask">
          <div class="image-crop-overlay__mask-piece image-crop-overlay__mask-piece--top" :style="maskTopStyle" />
          <div class="image-crop-overlay__mask-piece image-crop-overlay__mask-piece--bottom" :style="maskBottomStyle" />
          <div class="image-crop-overlay__mask-piece image-crop-overlay__mask-piece--left" :style="maskLeftStyle" />
          <div class="image-crop-overlay__mask-piece image-crop-overlay__mask-piece--right" :style="maskRightStyle" />
        </div>

        <div
          class="image-crop-overlay__crop-box"
          :style="cropBoxStyle"
          @mousedown.stop="startDrag('move', $event)"
        >
          <span
            v-for="handle in handles"
            :key="handle"
            class="image-crop-overlay__handle"
            :class="`image-crop-overlay__handle--${handle}`"
            @mousedown.stop="startDrag(handle, $event)"
          />
        </div>

        <span class="image-crop-overlay__size">{{ cropSizeLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  IMAGE_CROP_ASPECT_RATIOS,
  formatDimensions,
  type ImageCropAspectKey,
} from './constants'
import {
  clampCropRect,
  createFullCropRect,
  exportCroppedImage,
  getImageDisplayBounds,
  getTransformedSize,
  type CropRect,
} from './cropUtils'

const props = defineProps<{
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
}>()

const emit = defineEmits<{
  cancel: []
  complete: [payload: { dataUrl: string; width: number; height: number }]
}>()

const workspaceRef = ref<HTMLElement | null>(null)
const workspaceSize = ref({ width: 360, height: 420 })
const aspectKey = ref<ImageCropAspectKey>('free')
const showRatioMenu = ref(false)
const rotation = ref(0)
const flipX = ref(false)
const flipY = ref(false)
const completing = ref(false)
const cropRect = ref<CropRect>({ x: 0, y: 0, width: 100, height: 100 })

const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type Handle = (typeof handles)[number] | 'move'

let dragState: {
  handle: Handle
  startX: number
  startY: number
  startRect: CropRect
} | null = null

const currentRatio = computed(() => {
  const item = IMAGE_CROP_ASPECT_RATIOS.find((entry) => entry.key === aspectKey.value)
  if (!item || item.ratio === null) return null
  if (item.ratio === 'original') {
    const { width, height } = getTransformedSize(props.naturalWidth, props.naturalHeight, rotation.value)
    return width / height
  }
  return item.ratio
})

const currentRatioLabel = computed(
  () => IMAGE_CROP_ASPECT_RATIOS.find((item) => item.key === aspectKey.value)?.label ?? '比例裁剪',
)

const imageBounds = computed(() =>
  getImageDisplayBounds(
    workspaceSize.value.width,
    workspaceSize.value.height,
    props.naturalWidth,
    props.naturalHeight,
    rotation.value,
  ),
)

const imageWrapStyle = computed(() => {
  const bounds = imageBounds.value
  return {
    left: `${bounds.x}px`,
    top: `${bounds.y}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  }
})

const imageTransformStyle = computed(() => ({
  transform: `rotate(${rotation.value}deg) scaleX(${flipX.value ? -1 : 1}) scaleY(${flipY.value ? -1 : 1})`,
}))

const cropBoxStyle = computed(() => ({
  left: `${cropRect.value.x}px`,
  top: `${cropRect.value.y}px`,
  width: `${cropRect.value.width}px`,
  height: `${cropRect.value.height}px`,
}))

const cropSizeLabel = computed(() => {
  const bounds = imageBounds.value
  if (!bounds.width || !bounds.height) return '0 x 0'
  const { width, height } = getTransformedSize(props.naturalWidth, props.naturalHeight, rotation.value)
  const scaleX = width / bounds.width
  const scaleY = height / bounds.height
  const w = Math.round(cropRect.value.width * scaleX)
  const h = Math.round(cropRect.value.height * scaleY)
  return formatDimensions(w, h) ?? `${w} x ${h}`
})

const maskTopStyle = computed(() => ({
  left: '0',
  top: '0',
  width: '100%',
  height: `${Math.max(0, cropRect.value.y)}px`,
}))

const maskBottomStyle = computed(() => ({
  left: '0',
  top: `${cropRect.value.y + cropRect.value.height}px`,
  width: '100%',
  height: `${Math.max(0, workspaceSize.value.height - cropRect.value.y - cropRect.value.height)}px`,
}))

const maskLeftStyle = computed(() => ({
  left: '0',
  top: `${cropRect.value.y}px`,
  width: `${Math.max(0, cropRect.value.x)}px`,
  height: `${cropRect.value.height}px`,
}))

const maskRightStyle = computed(() => ({
  left: `${cropRect.value.x + cropRect.value.width}px`,
  top: `${cropRect.value.y}px`,
  width: `${Math.max(0, workspaceSize.value.width - cropRect.value.x - cropRect.value.width)}px`,
  height: `${cropRect.value.height}px`,
}))

function resetCropRect() {
  cropRect.value = createFullCropRect(imageBounds.value)
}

function resetTransform() {
  rotation.value = 0
  flipX.value = false
  flipY.value = false
  resetCropRect()
}

function rotate(delta: number) {
  rotation.value = (rotation.value + delta + 360) % 360
  resetCropRect()
}

function selectAspect(key: ImageCropAspectKey) {
  aspectKey.value = key
  showRatioMenu.value = false
  cropRect.value = clampCropRect(cropRect.value, imageBounds.value, currentRatio.value)
}

function updateWorkspaceSize() {
  if (!workspaceRef.value) return
  workspaceSize.value = {
    width: workspaceRef.value.clientWidth,
    height: workspaceRef.value.clientHeight,
  }
  resetCropRect()
}

function startDrag(handle: Handle, event: MouseEvent) {
  dragState = {
    handle,
    startX: event.clientX,
    startY: event.clientY,
    startRect: { ...cropRect.value },
  }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onWorkspaceMouseDown(event: MouseEvent) {
  if (event.target !== workspaceRef.value) return
  startDrag('move', event)
}

function onDragMove(event: MouseEvent) {
  if (!dragState) return

  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  const bounds = imageBounds.value
  const ratio = currentRatio.value
  let next = { ...dragState.startRect }

  switch (dragState.handle) {
    case 'move':
      next.x += dx
      next.y += dy
      break
    case 'nw':
      next.x += dx
      next.y += dy
      next.width -= dx
      next.height -= dy
      break
    case 'n':
      next.y += dy
      next.height -= dy
      break
    case 'ne':
      next.y += dy
      next.width += dx
      next.height -= dy
      break
    case 'e':
      next.width += dx
      break
    case 'se':
      next.width += dx
      next.height += dy
      break
    case 's':
      next.height += dy
      break
    case 'sw':
      next.x += dx
      next.width -= dx
      next.height += dy
      break
    case 'w':
      next.x += dx
      next.width -= dx
      break
  }

  if (ratio && ratio > 0 && dragState.handle !== 'move') {
    if (['n', 's'].includes(dragState.handle)) {
      next.width = next.height * ratio
    } else if (['e', 'w'].includes(dragState.handle)) {
      next.height = next.width / ratio
    } else {
      next.height = next.width / ratio
    }
  }

  cropRect.value = clampCropRect(next, bounds, ratio)
}

function onDragEnd() {
  dragState = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
}

async function handleComplete() {
  if (completing.value) return
  completing.value = true
  try {
    const result = await exportCroppedImage(
      props.imageUrl,
      cropRect.value,
      imageBounds.value,
      props.naturalWidth,
      props.naturalHeight,
      {
        rotation: rotation.value,
        flipX: flipX.value,
        flipY: flipY.value,
      },
    )
    emit('complete', result)
  } catch (error) {
    console.error('[ImageCropOverlay] export failed', error)
  } finally {
    completing.value = false
  }
}

watch(
  () => [props.naturalWidth, props.naturalHeight, rotation.value],
  () => resetCropRect(),
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
.image-crop-overlay {
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

.image-crop-overlay__toolbar {
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

.image-crop-overlay__btn {
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
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background: #1d4ed8;
    }

    &:disabled {
      opacity: 0.72;
      cursor: wait;
    }

    .image-crop-overlay__icon--check {
      filter: brightness(0) invert(1);
    }
  }

  &--active {
    background: #eef2ff;
  }
}

.image-crop-overlay__ratio {
  position: relative;
}

.image-crop-overlay__ratio-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 2;
  min-width: 120px;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.image-crop-overlay__ratio-item {
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

.image-crop-overlay__tools {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.image-crop-overlay__icon-btn {
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

  &:hover {
    background: #f3f4f6;
  }
}

.image-crop-overlay__workspace {
  position: relative;
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
  cursor: crosshair;
}

.image-crop-overlay__stage {
  position: relative;
  width: 100%;
  height: 100%;
}

.image-crop-overlay__image-wrap {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
}

.image-crop-overlay__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: center center;
  pointer-events: none;
  user-select: none;
}

.image-crop-overlay__mask-piece {
  position: absolute;
  background: rgba(15, 23, 42, 0.45);
  pointer-events: none;
}

.image-crop-overlay__crop-box {
  position: absolute;
  border: 2px solid #3b82f6;
  box-sizing: border-box;
  cursor: move;
}

.image-crop-overlay__handle {
  position: absolute;
  background: #3b82f6;
  box-shadow: 0 0 0 1px #fff;

  &--nw,
  &--ne,
  &--se,
  &--sw {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  &--n,
  &--s,
  &--e,
  &--w {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  &--nw { top: -5px; left: -5px; cursor: nwse-resize; }
  &--n { top: -4px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
  &--ne { top: -5px; right: -5px; cursor: nesw-resize; }
  &--e { top: 50%; right: -4px; transform: translateY(-50%); cursor: ew-resize; }
  &--se { bottom: -5px; right: -5px; cursor: nwse-resize; }
  &--s { bottom: -4px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
  &--sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
  &--w { top: 50%; left: -4px; transform: translateY(-50%); cursor: ew-resize; }
}

.image-crop-overlay__size {
  position: absolute;
  right: 12px;
  bottom: 10px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
  color: #6b7280;
  font-size: 12px;
  pointer-events: none;
}

.image-crop-overlay__icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 16px 16px;

  &--close {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23374151' stroke-linecap='round' stroke-width='1.2' d='M4.5 4.5l7 7M11.5 4.5l-7 7'/%3E%3C/svg%3E");
  }

  &--crop {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23374151' stroke-linecap='round' stroke-width='1.2' d='M4.5 2.5v9h9M11.5 13.5h-9v-9'/%3E%3C/svg%3E");
  }

  &--check {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%232563eb' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.4' d='M3.5 8.5 6.5 11.5 12.5 4.5'/%3E%3C/svg%3E");
  }

  &--rotate-left {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23374151' stroke-linecap='round' stroke-width='1.2' d='M4 6.5A4.5 4.5 0 0 1 11.5 4M4 6.5V4M4 6.5H6.5'/%3E%3C/svg%3E");
  }

  &--rotate-right {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23374151' stroke-linecap='round' stroke-width='1.2' d='M12 6.5A4.5 4.5 0 0 0 4.5 4M12 6.5V4M12 6.5H9.5'/%3E%3C/svg%3E");
  }

  &--flip-x {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23374151' stroke-linecap='round' stroke-width='1.2' d='M8 2.5v11M5 5.5 8 8l-3 2.5M11 5.5 8 8l3 2.5'/%3E%3C/svg%3E");
  }

  &--flip-y {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23374151' stroke-linecap='round' stroke-width='1.2' d='M2.5 8h11M5.5 5 8 8 5.5 11M5.5 11 8 8l2.5 3'/%3E%3C/svg%3E");
  }

  &--reset {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23374151' stroke-linecap='round' stroke-width='1.2' d='M4 6.5A4.5 4.5 0 0 1 11.5 4M4 6.5V4M4 6.5H6.5'/%3E%3C/svg%3E");
  }
}
</style>
