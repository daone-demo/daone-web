<template>
  <div ref="overlayRef" class="image-crop-overlay" @mousedown.stop>
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
          <!-- <span class="image-crop-overlay__icon image-crop-overlay__icon--crop" aria-hidden="true" /> -->
           <i class="iconfont icon-caijian" style="font-size: 18px;"></i>
          {{ currentRatioLabel }}
        </button>
        <div
          v-if="showRatioMenu"
          class="image-crop-overlay__ratio-menu"
          :style="ratioMenuStyle"
          @wheel.stop
          @mousedown.stop
        >
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
          <!-- <span class="image-crop-overlay__icon image-crop-overlay__icon--rotate-left" aria-hidden="true" /> -->
          <i class="iconfont icon-shangyibu" style="font-size: 14px;"></i>
        </button>
        <button type="button" class="image-crop-overlay__icon-btn" title="顺时针旋转" @click="rotate(90)">
          <!-- <span class="image-crop-overlay__icon image-crop-overlay__icon--rotate-right" aria-hidden="true" /> -->
          <i class="iconfont icon-xiayibu1" style="font-size: 14px;"></i>
        </button>
        <button type="button" class="image-crop-overlay__icon-btn" title="水平翻转" @click="flipX = !flipX">
          <!-- <img
            src="@/assets/images/out.png"
            style="width: 12px; height: auto;"
          /> -->
          <i class="iconfont icon-dodo-v-flip-copy" style="font-size: 18px;"></i>
        </button>
        <button type="button" class="image-crop-overlay__icon-btn" title="垂直翻转" @click="flipY = !flipY">
          <!-- <span class="image-crop-overlay__icon image-crop-overlay__icon--flip-y" aria-hidden="true" /> -->
          <!-- <img
            src="@/assets/images/up.png"
            style="width: 12px; height: auto;"
          /> -->
          <i class="iconfont icon-dodo-v-flip1" style="font-size: 18px;"></i>
        </button>
        <button type="button" class="image-crop-overlay__icon-btn" title="重置" @click="resetTransform">
          <!-- <span class="image-crop-overlay__icon image-crop-overlay__icon--reset" aria-hidden="true" /> -->
          <i class="iconfont icon-zhongzhi1" style="font-size: 18px;"></i>
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
/** 样式：styles/canvas-image-crop.scss（随 Canvas 主包加载，选择器挂在 .canvas 下） */

const props = defineProps<{
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
}>()

const emit = defineEmits<{
  cancel: []
  complete: [payload: { dataUrl: string; width: number; height: number }]
}>()

const overlayRef = ref<HTMLElement | null>(null)
const workspaceRef = ref<HTMLElement | null>(null)
const overlaySize = ref({ width: 360, height: 420 })
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

const ratioMenuStyle = computed(() => ({
  maxHeight: `${overlaySize.value.height * 0.75}px`,
}))

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

function updateOverlaySize() {
  if (overlayRef.value) {
    overlaySize.value = {
      width: overlayRef.value.clientWidth,
      height: overlayRef.value.clientHeight,
    }
  }
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
  updateOverlaySize()
  if (overlayRef.value) {
    resizeObserver = new ResizeObserver(updateOverlaySize)
    resizeObserver.observe(overlayRef.value)
  }
})

onBeforeUnmount(() => {
  onDragEnd()
  resizeObserver?.disconnect()
})
</script>
