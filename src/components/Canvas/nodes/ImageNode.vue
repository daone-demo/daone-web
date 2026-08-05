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
      'image-node--mark-target': data.imageMarkTarget,
    }"
  >
    <button
      v-if="!data.compactPreview || isGridSplitNode"
      type="button"
      class="node-port-plus"
      :style="portPlusStyle"
      title="添加连线节点"
      @mousedown.stop="onPlusPointerDown"
    >
      +
    </button>

    <button
      v-if="(!data.previewUrl || data.compactPreview) && !isGridSplitNode && !isFileUploading"
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
    </div>

    <div class="image-node__body">
      <button
        v-if="data.previewUrl && !data.compactPreview && !isGridSplitNode && !isFileUploading"
        type="button"
        class="canvas-node__delete-float image-node__preview-delete"
        title="删除节点"
        @mousedown.stop
        @click="removeSelf"
      >
        ×
      </button>
      <input
        v-if="!isGridSplitNode"
        ref="uploadInputRef"
        type="file"
        class="image-node__file-input"
        accept="image/*"
        @change="onUploadInputChange"
      />

      <button
        v-if="showReplaceUploadBtn"
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
          aria-hidden="true"
          role="img"
          class="iconify iconify--libtv pointer-events-none"
          width="14"
          height="14"
          viewBox="0 0 19.8008 19.8006"
        >
          <path d="M1.80078 16.9003C1.80087 17.1919 1.91684 17.4714 2.12305 17.6776C2.32932 17.8838 2.60874 17.9999 2.90039 17.9999H16.9004C17.192 17.9999 17.4715 17.8838 17.6777 17.6776C17.8839 17.4714 17.9999 17.1919 18 16.9003V11.9999H19.8008V16.9003C19.8007 17.6693 19.4949 18.4073 18.9512 18.951C18.4073 19.4948 17.6694 19.8006 16.9004 19.8006H2.90039C2.13135 19.8006 1.39345 19.4948 0.849609 18.951C0.305837 18.4073 9.33702e-05 17.6693 0 16.9003V11.9999H1.80078V16.9003ZM9.33203 0.202009C9.68553 -0.086443 10.2076 -0.0660213 10.5371 0.263533L16.1729 5.90025L14.9004 7.17271L10.8008 3.07408V13.8006H9V3.07408L4.90039 7.17271L3.62793 5.90025L9.26367 0.263533L9.33203 0.202009Z" fill="currentColor"></path>
        </svg>
      </button>

      <div
        class="image-node__preview"
        :class="{
          'image-node__preview--uploading': data.uploadState === 'uploading',
          'image-node__preview--dragover': isDragOver,
          'image-node__preview--readonly': isGridSplitNode || isAiGenerated,
        }"
        @click="onPreviewClick"
        @dblclick.stop="onPreviewDblClick"
        @dragenter.prevent="onDragOver"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent.stop="onDrop"
        @contextmenu.prevent="onPreviewContextMenu"
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
            @contextmenu.prevent.stop="onPreviewContextMenu"
          />
          <div
            v-if="(data.imageElementMarks?.length || 0) > 0"
            class="image-node__mark-layer"
            aria-hidden="true"
          >
            <!-- legacy mark pill UI removed -->
            <template v-for="(mark, index) in data.imageElementMarks ?? []" :key="mark.id">
              <div
                v-if="mark.bbox && !mark.pending"
                class="image-node__mark-box"
                :class="{ 'image-node__mark-box--selected': data.selectedImageElementMarkId === mark.id }"
                :style="markBoxStyle(mark)"
              />
              <div
                class="image-node__mark-pin-interactive"
                :class="{
                  'image-node__mark-pin--analyzing': mark.pending,
                  'image-node__mark-pin-interactive--selected': data.selectedImageElementMarkId === mark.id,
                }"
                :style="markPinStyle(mark)"
                @mousedown.stop
                @click.stop="onMarkPinClick(mark, $event)"
              >
                <button
                  type="button"
                  class="image-node__mark-pin-remove"
                  title="移除标记"
                  @mousedown.stop
                  @click.stop="onMarkRemoveClick(mark, $event)"
                >
                  <span class="image-node__mark-pin-remove-icon" aria-hidden="true" />
                </button>
                <svg 
                  data-v-243dd551=""
                  viewBox="0 0 24 24"
                  class="w-full h-full"
                  fill="none"
                  aria-hidden="true"
                  style="transform-origin: 50% 100%; transform: scale(1.5);"
                >
                  <path
                    data-v-243dd551=""
                    d="M12 23.4C7.6 19.8 4.6 16.9 4.6 11.8C4.6 7.2 8.1 3.9 12 3.9C15.9 3.9 19.4 7.2 19.4 11.8C19.4 16.9 16.4 19.8 12 23.4Z"
                    fill="#5aa3ff"
                    stroke="none"
                  ></path>
                  <path 
                    data-v-243dd551=""
                    d="M12 23.4C7.6 19.8 4.6 16.9 4.6 11.8C4.6 7.2 8.1 3.9 12 3.9C15.9 3.9 19.4 7.2 19.4 11.8C19.4 16.9 16.4 19.8 12 23.4Z"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="1.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <text
                    data-v-243dd551=""
                    x="12"
                    y="13"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-size="8"
                    font-weight="500"
                    fill="#ffffff"
                  >
                    {{ index + 1 }}
                  </text>
                </svg>
              </div>
              <!-- <div
                class="image-node__mark-pin"
                :class="{ 'image-node__mark-pin--analyzing': mark.pending }"
                :style="markPinStyle(mark)"
                :title="mark.label"
              >
                <span class="image-node__mark-pin-badge">{{ index + 1 }}</span>
              </div> -->
            </template>
          </div>
          <div
            v-if="showResizeHandles"
            class="image-node__resize-frame"
            @mousedown.stop
          >
            <button
              v-for="corner in resizeCorners"
              :key="corner"
              type="button"
              class="image-node__resize-handle"
              :class="`image-node__resize-handle--${corner}`"
              title="缩放"
              @mousedown.stop="onResizeHandlePointerDown($event, corner)"
            />
          </div>
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
import type { Graph, Node } from '@antv/x6'
import { CANVAS_IMAGE_NODE_DRAG_TYPE, canOpenImageDialogueOnNode, canReplaceImageNodePreview, isAiGeneratedImageNode, isNodeFileUploading, isPortrait, shouldAdaptImageNodeHeight } from '../constants'
import type { CanvasNodeData, ImageMarkItem } from '../constants'
import { createEmptyNodeData } from '../constants'
import { useNodeDelete } from './useNodeDelete'
import { useNodeConnect } from './useNodeConnect'
import { useNodePortPlusStyle } from './useNodePortPlusStyle'
import { useCanvasBgTheme } from '../useCanvasBgTheme'
import { syncNodeViewData } from './syncNodeViewData'
import { useCanvasNodeImage } from './useCanvasNodeImage'
import { resolveImageNaturalSizeCached } from '../imageDisplayUrl'
import { markStyleFromNatural } from '../imageMarkUtils'
import {
  canResizeImageNode,
  getNodeSize,
  syncNodeShapeFromData,
  type CanvasGraph,
  type ImageResizeCorner,
} from '../graph'

const getNode = inject<() => Node>('getNode')!
const getGraph = inject<() => Graph>('getGraph')!
const requestCanvasUpload = inject<(nodeId: string) => void>('requestCanvasUpload')
const uploadFileToCanvasNode = inject<(nodeId: string, file: File) => void>('uploadFileToCanvasNode')
const { removeSelf } = useNodeDelete()
const { onPlusPointerDown } = useNodeConnect()
const { portPlusStyle } = useNodePortPlusStyle()
const { isLightTheme } = useCanvasBgTheme()
const sizeRevision = ref(0)

const data = reactive<CanvasNodeData>({ ...createEmptyNodeData(), kind: 'image', title: '图片节点', mode: 'editor' })
const { displayUrl, isImageLoading, onImageLoad, onImageError } = useCanvasNodeImage(toRef(data, 'previewUrl'))
const isGridSplitNode = computed(() => Boolean(data.gridSplitTile))
const isAiGenerated = computed(() => isAiGeneratedImageNode(data))
const showReplaceUploadBtn = computed(() => canReplaceImageNodePreview(data))
const hasAdaptivePreview = computed(() => shouldAdaptImageNodeHeight(data))
const isFileUploading = computed(() => isNodeFileUploading(data))
const uploadInputRef = ref<HTMLInputElement | null>(null)

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

function markPinStyle(mark: ImageMarkItem) {
  const imageWidth = data.mediaWidth || mark.imageWidth || 1
  const imageHeight = data.mediaHeight || mark.imageHeight || 1
  return {
    left: markStyleFromNatural(mark.x, imageWidth, 'x'),
    top: markStyleFromNatural(mark.y, imageHeight, 'y'),
  }
}

function markBoxStyle(mark: ImageMarkItem) {
  const bbox = mark.bbox
  if (!bbox) return {}
  const imageWidth = data.mediaWidth || mark.imageWidth || 1
  const imageHeight = data.mediaHeight || mark.imageHeight || 1
  return {
    left: markStyleFromNatural(bbox.x, imageWidth, 'x'),
    top: markStyleFromNatural(bbox.y, imageHeight, 'y'),
    width: markStyleFromNatural(bbox.width, imageWidth, 'size'),
    height: markStyleFromNatural(bbox.height, imageHeight, 'size'),
  }
}

const resizeCorners: ImageResizeCorner[] = ['nw', 'ne', 'sw', 'se']

const showResizeHandles = computed(() => {
  void sizeRevision.value
  const graph = getGraph() as CanvasGraph
  return Boolean(
    graph.__primarySelectedNodeId?.() === getNode().id &&
    canResizeImageNode(data),
  )
})

function onResizeHandlePointerDown(event: MouseEvent, corner: ImageResizeCorner) {
  const graph = getGraph() as CanvasGraph
  graph.__startImageNodeCornerResize?.(event, corner)
}
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
  if (isGridSplitNode.value || isAiGenerated.value) return
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
  if (isGridSplitNode.value || isAiGenerated.value) return
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
  // 有预览时单击仅选中节点（由 graph node:click 处理，显示上方操作栏），双击再打开下方对话框
  if (data.previewUrl?.trim() && data.uploadState !== 'uploading') {
    cancelPendingUpload()
    return
  }
  cancelPendingUpload()
  uploadClickTimer = setTimeout(() => {
    requestFile()
    uploadClickTimer = null
  }, UPLOAD_CLICK_DELAY)
}

function onPreviewDblClick() {
  cancelPendingUpload()
  if (!canOpenImageDialogueOnNode(data)) return
  const node = getNode()
  const g = node.model?.graph as CanvasGraph | undefined
  g?.__openImageDialogue?.(node.id)
}

function onPreviewContextMenu(event: MouseEvent) {
  if (!data.previewUrl || data.uploadState === 'uploading' || isGridSplitNode.value) return
  event.preventDefault()
  event.stopPropagation()
  const g = getGraph() as CanvasGraph
  g.__openMediaContextMenu?.(getNode().id, event.clientX, event.clientY)
}

function onMarkPinClick(mark: ImageMarkItem, event: MouseEvent) {
  if (mark.pending) return
  event.preventDefault()
  event.stopPropagation()
  const g = getGraph() as CanvasGraph
  g.__selectImageElementMark?.(mark.id)
}

function onMarkRemoveClick(mark: ImageMarkItem, event: MouseEvent) {
  if (mark.pending) return
  event.preventDefault()
  event.stopPropagation()
  const g = getGraph() as CanvasGraph
  g.__removeImageElementMark?.(mark.id)
}

function onUploadClick() {
  if (data.uploadState === 'uploading' || !showReplaceUploadBtn.value) return
  cancelPendingUpload()
  const input = uploadInputRef.value
  if (!input) return
  input.value = ''
  input.click()
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

.image-node__preview-delete {
  top: -30px;
  right: -30px;
  z-index: 4;
  border-radius: 50%;
  background: rgba(125, 125, 125, 0.72);
  opacity: 0;
}

.image-node:hover .image-node__preview-delete,
.image-node--selected .image-node__preview-delete {
  opacity: 1;
}

.image-node__preview-delete:hover {
  background: rgba(17, 24, 39, 0.9);
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

.image-node--light {
  .image-node__upload-btn {
    border-color: #d1d5db;
    background: rgba(255, 255, 255, 0.92);
    color: #374151;

    &:hover,
    &--active {
      background: #fff;
      border-color: #6b7cff;
      color: #111827;
    }
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
  overflow: visible;
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

.image-node__mark-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.image-node__mark-box {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid #ef4444;
  border-radius: 2px;
  background: rgba(239, 68, 68, 0.06);
  pointer-events: none;

  &--selected {
    border-width: 3px;
    background: rgba(239, 68, 68, 0.12);
    box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.35);
  }
}

.image-node__mark-pin-interactive {
  position: absolute;
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.18));
  transform: translate(-50%, -100%);
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.15s ease;

  &:hover:not(.image-node__mark-pin--analyzing) {
    transform: translate(-50%, -100%) scale(1.1);
  }

  &--selected {
    filter: drop-shadow(0 0 0 2px #ef4444) drop-shadow(0 1px 2px rgba(15, 23, 42, 0.18));
  }
}

.image-node__mark-pin-remove {
  position: absolute;
  top: -12px;
  right: -8px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1.5px solid #fff;
  border-radius: 50%;
  background: rgba(17, 24, 39, 0.88);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, background 0.15s ease;

  &:hover {
    background: rgba(17, 24, 39, 0.98);
  }
}

.image-node__mark-pin-remove-icon {
  width: 8px;
  height: 8px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' fill='none' viewBox='0 0 8 8'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-width='1.2' d='m1.8 1.8 4.4 4.4M6.2 1.8 1.8 6.2'/%3E%3C/svg%3E") center / 8px 8px no-repeat;
}

.image-node__mark-pin-interactive:hover,
.image-node__mark-pin-interactive--selected {
  .image-node__mark-pin-remove {
    opacity: 1;
    pointer-events: auto;
  }
}

.image-node__mark-pin {
  position: absolute;
  transform: translate(-50%, -100%);
  pointer-events: none;

  &--analyzing .image-node__mark-pin-badge {
    animation: image-node-mark-pin-pulse 1.2s ease-in-out infinite;
  }
}

.image-node__mark-pin-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border: 2px solid #fff;
  border-radius: 999px;
  background: #3b82f6;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -7px;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 8px solid #3b82f6;
    transform: translateX(-50%);
  }
}

@keyframes image-node-mark-pin-pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
  }

  50% {
    transform: scale(1.08);
    box-shadow: 0 6px 18px rgba(37, 99, 235, 0.5);
  }
}

.image-node__mark-pill-wrap {
  position: absolute;
  transform: translate(-50%, calc(-100% - 8px));
}

.image-node__mark-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: calc(100vw - 24px);
  padding: 4px 10px;
  border: none;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.92);
  color: #fff;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  cursor: pointer;
}

.image-node__mark-pill-icon {
  font-size: 10px;
  opacity: 0.9;
}

.image-node__mark-pill-chevron {
  font-size: 12px;
  opacity: 0.85;
}

.image-node__mark-menu {
  position: absolute;
  left: 50%;
  top: calc(100% + 6px);
  transform: translateX(-50%);
  min-width: 120px;
  padding: 6px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.image-node__mark-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #111827;
  font-size: 14px;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.image-node__mark-menu-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;

  &--active {
    background: #9ca3af;
  }
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

.image-node__resize-frame {
  position: absolute;
  inset: 0;
  z-index: 3;
  box-sizing: border-box;
  border: 1.5px solid #6b7cff;
  border-radius: 2px;
  pointer-events: none;
}

.image-node__resize-size {
  position: absolute;
  left: 50%;
  bottom: -18px;
  transform: translateX(-50%);
  font-size: 11px;
  line-height: 1;
  color: #9ca3af;
  white-space: nowrap;
  pointer-events: none;
}

.image-node__resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  padding: 0;
  border: 1.5px solid #6b7cff;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85);
  pointer-events: auto;
  cursor: nwse-resize;
  touch-action: none;
  opacity: 0;
  &--nw {
    top: -5px;
    left: -5px;
    cursor: nwse-resize;
  }

  &--ne {
    top: -5px;
    right: -5px;
    cursor: nesw-resize;
  }

  &--sw {
    bottom: -5px;
    left: -5px;
    cursor: nesw-resize;
  }

  &--se {
    bottom: -5px;
    right: -5px;
    cursor: nwse-resize;
  }

  &:hover {
    background: #fff;
  }
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
