<template>
  <div
    class="image-gen-node"
    :class="{
      'image-gen-node--selected': data.isSelected,
      'image-gen-node--img2img': data.imageGenTask === 'img2img',
      'image-gen-node--light': isLightTheme,
      'image-gen-node--card-only': isEmptyUpload,
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
      v-if="isEmptyUpload"
      type="button"
      class="canvas-node__delete-float"
      title="删除节点"
      @mousedown.stop
      @click="removeSelf"
    >
      ×
    </button>

    <div v-if="!isEmptyUpload" class="image-gen-node__meta canvas-node__meta">
      <span class="image-gen-node__title">
        <span v-if="data.imageGenTask === 'img2img'" class="image-gen-node__title-icon">图</span>
        <span class="image-gen-node__title-text">{{ headerTitle }}</span>
      </span>
      <span v-if="data.imageGenTask === 'img2img' && data.inputUpdated" class="image-gen-node__status">
        ① 输入已更新
      </span>
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

    <div class="image-gen-node__body">
      <div
        v-if="data.imageGenState === 'loading'"
        class="image-gen-node__picker"
      >
        <div class="image-gen-node__preview image-gen-node__preview--empty">
          <span class="image-gen-node__spinner" aria-hidden="true" />
        </div>
        <p class="image-gen-node__hd-hint">{{ genHintText }}</p>
      </div>

      <div
        v-else-if="data.imageGenState"
        class="image-gen-node__picker"
      >
        <div
          class="image-gen-node__preview"
          :class="data.previewUrl ? 'image-gen-node__preview--output' : 'image-gen-node__preview--empty'"
        >
          <img v-if="data.previewUrl" :src="data.previewUrl" :alt="data.fileName" />
          <span v-else class="image-gen-node__placeholder-icon" aria-hidden="true" />
        </div>
      </div>

      <div
        v-else-if="isEmptyUpload"
        class="image-gen-node__preview"
        :class="{ 'image-gen-node__preview--dragover': isDragOver }"
        @click="triggerUpload"
        @dragenter.prevent="onDragOver"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent.stop="onDrop"
      >
        <i class="iconfont icon-shangchuantupian1" style="font-size: 36px;"></i>
        <span>{{ isDragOver ? '松开以上传图片' : '点击或拖拽图片到此处上传' }}</span>
      </div>

      <div
        v-else-if="data.imageGenTask === 'img2img'"
        class="image-gen-node__picker"
      >
        <div
          class="image-gen-node__preview"
          :class="[
            data.previewUrl ? 'image-gen-node__preview--output' : 'image-gen-node__preview--empty',
            { 'image-gen-node__preview--dragover': isDragOver },
          ]"
          @click="triggerUpload"
          @dragenter.prevent="onDragOver"
          @dragover.prevent="onDragOver"
          @dragleave="onDragLeave"
          @drop.prevent.stop="onDrop"
        >
          <img v-if="data.previewUrl" :src="data.previewUrl" :alt="data.fileName" />
          <span v-else class="image-gen-node__placeholder-icon" aria-hidden="true" />
        </div>
      </div>

      <div v-else class="image-gen-node__picker">
        <div class="image-gen-node__preview image-gen-node__preview--empty">
          <span class="image-gen-node__placeholder-icon" aria-hidden="true" />
        </div>
        <p class="image-gen-node__hd-hint">图片高清处理中…</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref } from 'vue'
import type { Node } from '@antv/x6'
import type { CanvasNodeData } from '../constants'
import { createEmptyNodeData } from '../constants'
import { useNodeDelete } from './useNodeDelete'
import { useNodeConnect } from './useNodeConnect'
import { useCanvasBgTheme } from '../useCanvasBgTheme'

const { isLightTheme } = useCanvasBgTheme()
const getNode = inject<() => Node>('getNode')!
const requestCanvasUpload = inject<(nodeId: string) => void>('requestCanvasUpload')
const uploadFileToCanvasNode = inject<(nodeId: string, file: File) => void>('uploadFileToCanvasNode')
const { removeSelf } = useNodeDelete()
const { onPlusPointerDown } = useNodeConnect()

const data = reactive<CanvasNodeData>({
  ...createEmptyNodeData(),
  kind: 'image',
  title: '图片节点',
  mode: 'picker',
  imageGenTask: 'picker',
})

const headerTitle = computed(() => {
  if (data.imageGenTask === 'img2img') return '图生图'
  if (data.imageGenTask === 'hd') return '图片高清'
  return data.title
})

const genHintText = computed(() => {
  const p = data.imageGenProgress ?? 0
  return p < 1 ? '准备中...' : `生成中 ${p}%...`
})

const isEmptyUpload = computed(
  () =>
    data.imageGenTask === 'picker' &&
    !data.previewUrl &&
    !data.imageGenState,
)

function triggerUpload() {
  requestCanvasUpload?.(getNode().id)
}

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

function onDrop(event: DragEvent) {
  isDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  uploadFileToCanvasNode?.(getNode().id, file)
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

.image-gen-node {
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

.image-gen-node--card-only {
  .image-gen-node__body {
    flex: 1;
    min-height: 0;
    height: auto;
    padding: 0;
  }
}

.image-gen-node__meta {
  margin-bottom: 6px;
  font-size: 12px;
}

.image-gen-node__title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  color: #9ca3af;
}

.image-gen-node__title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #3d3d45;
  font-size: 10px;
  color: #d1d5db;
}

.image-gen-node__title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-gen-node__status {
  flex-shrink: 0;
  color: #9ca3af;
  font-size: 11px;
}

.image-gen-node__body {
  position: relative;
  display: flex;
  flex-direction: column;
  height: calc(100% - 24px);
  padding: 10px;
  border: 1px solid #4b4b55;
  border-radius: 14px;
  background: #1e1e22;
  box-sizing: border-box;
}

.image-gen-node__picker {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.image-gen-node__preview {
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
  overflow: hidden;
  cursor: pointer;

  &--empty {
    flex: 1;
    min-height: 140px;
    cursor: pointer;
  }

  &--output {
    flex: 1;
    min-height: 140px;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &--dragover {
    outline: 2px dashed #6b7cff;
    outline-offset: -6px;
    background: rgba(107, 124, 255, 0.08);
    color: #6b7cff;
    cursor: pointer;
  }
}

.image-gen-node__placeholder-symbol {
  font-size: 28px;
  opacity: 0.5;
}

.image-gen-node__placeholder-icon {
  width: 48px;
  height: 40px;
  border: 2px solid #4b5563;
  border-radius: 6px;
  opacity: 0.55;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 8px;
    bottom: 8px;
    width: 14px;
    height: 10px;
    border-left: 2px solid #6b7280;
    border-bottom: 2px solid #6b7280;
    transform: skewX(-12deg);
  }

  &::after {
    content: '';
    position: absolute;
    top: 8px;
    right: 10px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #6b7280;
  }

  &--lg {
    width: 64px;
    height: 52px;
  }
}

.image-gen-node__hd-hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: #6b7280;
  text-align: center;
}

.image-gen-node__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(107, 124, 255, 0.25);
  border-top-color: #6b7cff;
  border-radius: 50%;
  animation: image-gen-spin 0.8s linear infinite;
}

@keyframes image-gen-spin {
  to { transform: rotate(360deg); }
}
</style>
