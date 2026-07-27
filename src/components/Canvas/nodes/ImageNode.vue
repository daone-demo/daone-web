<template>
  <div
    class="image-node"
    :class="{
      'image-node--portrait': isPortraitLayout,
      'image-node--selected': data.isSelected,
      'image-node--light': isLightTheme,
      'image-node--card-only': !data.previewUrl,
      'image-node--compact': data.compactPreview,
      'image-node--grid-split': !!data.gridSplitTile,
      'image-node--uploading': data.uploadState === 'uploading',
      'image-node--generating': data.imageGenState === 'loading',
      'image-node--adaptive': hasAdaptivePreview,
    }"
  >
    <button
      v-if="!data.compactPreview || isGridSplitNode"
      type="button"
      class="node-port-plus"
      title="添加连线节点"
      @mousedown.stop="onPlusPointerDown"
    >
      +
    </button>

    <button
      v-if="(!data.previewUrl || data.compactPreview) && !isGridSplitNode"
      type="button"
      class="canvas-node__delete-float"
      title="删除节点"
      @mousedown.stop
      @click="removeSelf"
    >
      ×
    </button>

    <div v-if="data.previewUrl && !data.compactPreview && !data.hideNodeMeta" class="image-node__meta canvas-node__meta">
      <span class="image-node__title">
        <!-- <span class="image-node__title-icon">▣</span> -->
        <i class="iconfont icon-tupian" style="font-size: 18px;" />
        <span class="image-node__title-text">{{ data.title }}</span>
      </span>
      <span v-if="dimensionLabel" class="image-node__size">{{ dimensionLabel }}</span>
      <button
        type="button"
        class="canvas-node__delete"
        title="删除节点"
        @mousedown.stop
        @click="removeSelf"
      >
        ×
      </button>
    </div>

    <div class="image-node__body">
      <input
        v-if="!isGridSplitNode"
        type="file"
        class="image-node__file-input"
        accept="image/*"
        @change="onUploadInputChange"
      />

      <!-- <button
        v-if="!isGridSplitNode"
        type="button"
        class="image-node__upload-btn"
        :class="{ 'image-node__upload-btn--disabled': data.uploadState === 'uploading' }"
        title="重新上传图片"
        :disabled="data.uploadState === 'uploading'"
        @mousedown.stop
        @click.stop="onUploadClick"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
          aria-hidden="true"
          role="img"
          class="iconify iconify--libtv pointer-events-none "
          width="14"
          height="14"
          viewBox="0 0 19.8008 19.8006"
        >
          <path d="M1.80078 16.9003C1.80087 17.1919 1.91684 17.4714 2.12305 17.6776C2.32932 17.8838 2.60874 17.9999 2.90039 17.9999H16.9004C17.192 17.9999 17.4715 17.8838 17.6777 17.6776C17.8839 17.4714 17.9999 17.1919 18 16.9003V11.9999H19.8008V16.9003C19.8007 17.6693 19.4949 18.4073 18.9512 18.951C18.4073 19.4948 17.6694 19.8006 16.9004 19.8006H2.90039C2.13135 19.8006 1.39345 19.4948 0.849609 18.951C0.305837 18.4073 9.33702e-05 17.6693 0 16.9003V11.9999H1.80078V16.9003ZM9.33203 0.202009C9.68553 -0.086443 10.2076 -0.0660213 10.5371 0.263533L16.1729 5.90025L14.9004 7.17271L10.8008 3.07408V13.8006H9V3.07408L4.90039 7.17271L3.62793 5.90025L9.26367 0.263533L9.33203 0.202009Z" fill="currentColor"></path>
        </svg>
      </button> -->

      <div
        class="image-node__preview"
        :class="{
          'image-node__preview--uploading': data.uploadState === 'uploading',
          'image-node__preview--dragover': isDragOver,
          'image-node__preview--readonly': isGridSplitNode,
        }"
        @click="onPreviewClick"
        @dblclick.stop="onPreviewDblClick"
        @dragenter.prevent="onDragOver"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent.stop="onDrop"
      >
        <template v-if="data.uploadState === 'uploading'">
          <div class="image-node__uploading">
            <span class="image-node__spinner" aria-hidden="true" />
            <span class="image-node__uploading-text">
              上传中 ({{ data.uploadProgress }}%) ...
            </span>
          </div>
        </template>
        <template v-else-if="data.imageGenState === 'loading'">
          <div class="image-node__generating">
            <span class="image-node__spinner" aria-hidden="true" />
            <span class="image-node__generating-text">{{ genProgressText }}</span>
          </div>
        </template>
        <template v-else-if="data.previewUrl">
          <div v-if="isImageLoading && !isGridSplitNode" class="image-node__image-loading" aria-hidden="true">
            <span class="image-node__spinner" />
          </div>
          <img
            :src="displayUrl"
            :alt="data.fileName"
            decoding="async"
            draggable="true"
            @load="onPreviewImageLoad"
            @error="onImageError"
            @dragstart.stop="onPreviewDragStart"
          />
          <!-- <span v-if="showUploadSuccess" class="image-node__success">上传成功</span> -->
        </template>
        <template v-else>
          <i class="iconfont icon-shangchuantupian1" style="font-size: 36px;"></i>
          <span>{{ isDragOver ? '松开以上传图片' : '点击或拖拽图片到此处上传' }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref, toRef } from 'vue'
import type { Node } from '@antv/x6'
import { CANVAS_IMAGE_NODE_DRAG_TYPE, formatDimensions, isPortrait, shouldAdaptImageNodeHeight } from '../constants'
import type { CanvasNodeData } from '../constants'
import { createEmptyNodeData } from '../constants'
import { useNodeDelete } from './useNodeDelete'
import { useNodeConnect } from './useNodeConnect'
import { useCanvasBgTheme } from '../useCanvasBgTheme'
import { syncNodeViewData } from './syncNodeViewData'
import { useCanvasNodeImage } from './useCanvasNodeImage'
import { resolveImageNaturalSizeCached } from '../imageDisplayUrl'
import { getBaseNodeSize, getNodeSize, syncNodeShapeFromData, type CanvasGraph } from '../graph'

const getNode = inject<() => Node>('getNode')!
const requestCanvasUpload = inject<(nodeId: string) => void>('requestCanvasUpload')
const uploadFileToCanvasNode = inject<(nodeId: string, file: File) => void>('uploadFileToCanvasNode')
const { removeSelf } = useNodeDelete()
const { onPlusPointerDown } = useNodeConnect()
const { isLightTheme } = useCanvasBgTheme()
const sizeRevision = ref(0)

const data = reactive<CanvasNodeData>({ ...createEmptyNodeData(), kind: 'image', title: '图片节点', mode: 'editor' })
const { displayUrl, isImageLoading, onImageLoad, onImageError } = useCanvasNodeImage(toRef(data, 'previewUrl'))
const isGridSplitNode = computed(() => Boolean(data.gridSplitTile))
const hasAdaptivePreview = computed(() => shouldAdaptImageNodeHeight(data))

const genProgressText = computed(() => {
  const progress = data.imageGenProgress ?? 0
  if (progress <= 0) return '准备中...'
  if (progress >= 100) return '即将完成...'
  return `${progress}%`
})

function applyImageNaturalSize(size: { width: number; height: number }, previewUrl: string) {
  const node = getNode()
  const current = { ...(node.getData() as CanvasNodeData) }
  if (current.previewUrl?.trim() !== previewUrl) return
  if (current.mediaWidth > 0 && current.mediaHeight > 0) return
  current.mediaWidth = size.width
  current.mediaHeight = size.height
  node.setData(current)
  syncNodeViewData(data, current)
  syncNodeShapeFromData(node)
  const nextSize = getNodeSize(current.kind, current.mode, current)
  node.resize(nextSize.width, nextSize.height)
}

function onPreviewImageLoad() {
  onImageLoad()
  const previewUrl = data.previewUrl?.trim()
  if (!previewUrl || (data.mediaWidth > 0 && data.mediaHeight > 0)) return
  void resolveImageNaturalSizeCached(previewUrl)
    .then((size) => applyImageNaturalSize(size, previewUrl))
    .catch(() => {
      // ignore
    })
}

const dimensionLabel = computed(() => {
  void sizeRevision.value
  if (!data.mediaWidth || !data.mediaHeight) return ''
  const node = getNode()
  const baseSize = getBaseNodeSize(data.kind, data.mode, { ...data, viewScale: 1 })
  if (!baseSize.width) return ''
  const scale = node.getSize().width / baseSize.width
  const width = Math.round(data.mediaWidth * scale)
  const height = Math.round(data.mediaHeight * scale)
  return formatDimensions(width, height)
})
const isPortraitLayout = computed(() =>
  data.mediaWidth && data.mediaHeight
    ? isPortrait(data.mediaWidth, data.mediaHeight)
    : false,
)

let uploadClickTimer: ReturnType<typeof setTimeout> | null = null
const UPLOAD_CLICK_DELAY = 280

const isDragOver = ref(false)

function hasDraggedFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function onDragOver(event: DragEvent) {
  if (isGridSplitNode.value) return
  if (!hasDraggedFiles(event)) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onPreviewDragStart(event: DragEvent) {
  if (!data.previewUrl || data.uploadState === 'uploading') return
  event.dataTransfer?.setData(CANVAS_IMAGE_NODE_DRAG_TYPE, getNode().id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function uploadImageFile(file: File) {
  const node = getNode()
  const g = node.model?.graph as CanvasGraph | undefined
  if (typeof g?.__uploadFileToCanvasNode === 'function') {
    g.__uploadFileToCanvasNode(node.id, file)
    return
  }
  uploadFileToCanvasNode?.(node.id, file)
}

function onDrop(event: DragEvent) {
  if (isGridSplitNode.value) return
  isDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  cancelPendingUpload()
  uploadImageFile(file)
}

function requestFile() {
  requestCanvasUpload?.(getNode().id)
}

function cancelPendingUpload() {
  if (!uploadClickTimer) return
  clearTimeout(uploadClickTimer)
  uploadClickTimer = null
}

function onPreviewClick() {
  if (isGridSplitNode.value) return
  cancelPendingUpload()
  uploadClickTimer = setTimeout(() => {
    requestFile()
    uploadClickTimer = null
  }, UPLOAD_CLICK_DELAY)
}

function onPreviewDblClick() {
  cancelPendingUpload()
  const node = getNode()
  const g = node.model?.graph as CanvasGraph | undefined
  g?.__openImageDialogue?.(node.id)
}

function onUploadInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !file.type.startsWith('image/')) return
  uploadImageFile(file)
}

onMounted(() => {
  const node = getNode()
  syncNodeViewData(data, node.getData() as CanvasNodeData)
  node.on('change:data', ({ current }) => {
    syncNodeViewData(data, current as CanvasNodeData)
  })
  node.on('change:size', () => {
    sizeRevision.value += 1
  })

  const previewUrl = data.previewUrl?.trim()
  if (previewUrl && !(data.mediaWidth > 0 && data.mediaHeight > 0)) {
    void resolveImageNaturalSizeCached(previewUrl)
      .then((size) => applyImageNaturalSize(size, previewUrl))
      .catch(() => {
        // ignore
      })
  }
})
</script>

<style scoped lang="scss">
@import './node-delete.scss';
@import './node-port-plus.scss';
@import './node-light-theme.scss';
@import './node-generating-bg.scss';
.image-node {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, sans-serif;
  color: #f3f4f6;
  pointer-events: auto;
  overflow: visible;
}

.image-node--card-only,
.image-node--uploading {
  .image-node__body {
    flex: 1;
    min-height: 0;
    height: 100%;
  }
}

.image-node--adaptive {
  .image-node__body {
    flex: 1;
    min-height: 0;
    height: 100%;
  }

  .image-node__preview {
    height: 100%;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }
}

.image-node__meta {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 6px;
  font-size: 12px;
}

.image-node__title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  color: #9ca3af;
}

.image-node__title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-node__size {
  color: #6b7280;
  font-size: 11px;
}

.image-node--selected .image-node__size {
  display: inline;
}

.image-node__title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #3d3d45;
  font-size: 10px;
}

.image-node__body {
  position: relative;
  height: 100%;
  // padding: 10px;
  border: 1px solid #4b4b55;
  border-radius: 14px;
  background: #1e1e22;
  box-sizing: border-box;
}

.image-node--selected .image-node__body {
  outline: none;
  box-shadow: none;
}

.image-node__scale-btn {
  position: absolute;
  top: 16px;
  right: 48px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #4b4b55;
  border-radius: 8px;
  background: rgba(30, 30, 34, 0.85);
  color: #e5e7eb;
  font-size: 12px;
  cursor: nwse-resize;
  touch-action: none;

  &:hover,
  &--active {
    background: #2a2a30;
    border-color: #6b7cff;
    color: #fff;
  }
}

.image-node__file-input {
  display: none;
}

.image-node__upload-btn {
  position: absolute;
  top: 16px;
  right: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #4b4b55;
  border-radius: 8px;
  background: rgba(30, 30, 34, 0.85);
  color: #e5e7eb;
  font-size: 12px;
  cursor: pointer;
  touch-action: none;

  &:hover,
  &--active {
    background: #2a2a30;
    border-color: #6b7cff;
    color: #fff;
  }

  &--disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.image-node__preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 10px;
  background: #141416;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  overflow: hidden;
  position: relative;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
  }
}

.image-node__image-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 20, 22, 0.72);
  pointer-events: none;
}

.image-node__preview--uploading {
  cursor: default;
}

.image-node__uploading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 100%;
  text-align: center;
}

.image-node__uploading-text {
  line-height: 1.4;
  white-space: nowrap;
}

.image-node__generating {
  @include node-generating-background();
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 100%;
  text-align: center;
}

.image-node__generating-text {
  font-size: 12px;
  color: #8a8a8a;
  line-height: 1.4;
  white-space: nowrap;
}

.image-node__preview--readonly {
  cursor: default;
}

.image-node__preview--dragover {
  outline: 2px dashed #6b7cff;
  outline-offset: -6px;
  background: rgba(107, 124, 255, 0.08);
  color: #6b7cff;
}

.image-node--portrait .image-node__preview {
  min-height: 0;
}

.image-node--compact {
  background: transparent;
  box-shadow: none;

  .image-node__body {
    height: 100%;
    border: none;
    border-radius: 0;
    background: transparent;
  }

  .image-node__preview {
    border-radius: 0;
    background: transparent;
    box-sizing: border-box;

    img {
      object-fit: contain;
    }
  }

  &.image-node--grid-split .image-node__preview img {
    // 节点尺寸已按碎片像素等比缩放，铺满即可保证相邻缝宽视觉一致为 2px
    object-fit: fill;
  }

  .image-node__scale-btn {
    top: 8px;
    right: 36px;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    opacity: 0;
  }

  .canvas-node__delete-float {
    opacity: 0;
  }

  &:not(.image-node--grid-split):hover .image-node__scale-btn,
  &:not(.image-node--grid-split):hover .canvas-node__delete-float,
  &:not(.image-node--grid-split).image-node--selected .image-node__scale-btn,
  &:not(.image-node--grid-split).image-node--selected .canvas-node__delete-float,
  .image-node__scale-btn--active {
    opacity: 1;
  }
}

.image-node__success {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 14px;
  pointer-events: none;
}

.image-node__placeholder-icon {
  font-size: 28px;
  opacity: 0.5;
}

.image-node__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #3d3d45;
  border-top-color: #6b7cff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
