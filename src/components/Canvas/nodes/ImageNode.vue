<template>
  <div
    class="image-node"
    :class="{
      'image-node--portrait': isPortraitLayout,
      'image-node--selected': data.isSelected,
      'image-node--light': isLightTheme,
      'image-node--card-only': !data.previewUrl,
      'image-node--uploading': data.uploadState === 'uploading',
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
      v-if="!data.previewUrl"
      type="button"
      class="canvas-node__delete-float"
      title="删除节点"
      @mousedown.stop
      @click="removeSelf"
    >
      ×
    </button>

    <div v-if="data.previewUrl" class="image-node__meta canvas-node__meta">
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
      <button
        v-if="data.previewUrl"
        type="button"
        class="image-node__scale-btn"
        :class="{ 'image-node__scale-btn--active': isResizing }"
        title="缩放视图"
        @mousedown.stop="startResize"
      >
        ↗
      </button>

      <div
        class="image-node__preview"
        :class="{
          'image-node__preview--uploading': data.uploadState === 'uploading',
          'image-node__preview--dragover': isDragOver,
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
        <template v-else-if="data.previewUrl">
          <img
            :src="data.previewUrl"
            :alt="data.fileName"
            draggable="true"
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
import { computed, inject, onMounted, reactive, ref } from 'vue'
import type { Node } from '@antv/x6'
import { CANVAS_IMAGE_NODE_DRAG_TYPE, formatDimensions, isPortrait } from '../constants'
import type { CanvasNodeData } from '../constants'
import type { CanvasGraph } from '../graph'
import { createEmptyNodeData } from '../constants'
import { useNodeDelete } from './useNodeDelete'
import { useNodeConnect } from './useNodeConnect'
import { useNodeViewScale } from './useNodeViewScale'
import { useCanvasBgTheme } from '../useCanvasBgTheme'

const getNode = inject<() => Node>('getNode')!
const requestCanvasUpload = inject<(nodeId: string) => void>('requestCanvasUpload')
const uploadFileToCanvasNode = inject<(nodeId: string, file: File) => void>('uploadFileToCanvasNode')
const { removeSelf } = useNodeDelete()
const { onPlusPointerDown } = useNodeConnect()
const { startResize, previewScale, isResizing } = useNodeViewScale()
const { isLightTheme } = useCanvasBgTheme()

const data = reactive<CanvasNodeData>({ ...createEmptyNodeData(), kind: 'image', title: '图片节点', mode: 'editor' })

const dimensionLabel = computed(() => {
  const scale = previewScale.value ?? data.viewScale ?? 1
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

function onDrop(event: DragEvent) {
  isDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  cancelPendingUpload()
  uploadFileToCanvasNode?.(getNode().id, file)
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

onMounted(() => {
  const node = getNode()
  Object.assign(data, node.getData() as CanvasNodeData)
  node.on('change:data', ({ current }) => {
    Object.assign(data, current as CanvasNodeData)
  })
})
</script>

<style scoped lang="scss">
@import './node-delete.scss';
@import './node-port-plus.scss';
@import './node-light-theme.scss';
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

.image-node__meta {
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
  height: calc(100% - 24px);
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
  right: 16px;
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
    object-fit: cover;
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

.image-node__preview--dragover {
  outline: 2px dashed #6b7cff;
  outline-offset: -6px;
  background: rgba(107, 124, 255, 0.08);
  color: #6b7cff;
}

.image-node--portrait .image-node__preview {
  min-height: 0;
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
