<template>
  <div
    class="video-node"
    :class="{
      'video-node--selected': data.isSelected,
      'video-node--light': isLightTheme,
      'video-node--picker-card': data.mode === 'picker',
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
      type="button"
      class="canvas-node__delete-float"
      title="删除节点"
      @mousedown.stop
      @click="removeSelf"
    >
      ×
    </button>
    <!-- <div class="video-node__meta canvas-node__meta">
      <span class="video-node__title">
        <span class="video-node__play">▶</span>
        <span class="video-node__title-text">{{ data.title }}</span>
      </span>
      <span v-if="dimensionLabel" class="video-node__size">{{ dimensionLabel }}</span>
      <button
        type="button"
        class="canvas-node__delete"
        title="删除节点"
        @mousedown.stop
        @click="removeSelf"
      >
        ×
      </button>
    </div> -->

    <button
      v-if="data.mode === 'picker'"
      type="button"
      class="video-node__upload-btn"
      @mousedown.stop
      @click="triggerUpload"
    >
      ↑ 上传
    </button>

    <div v-if="data.mode === 'picker'" class="video-node__body video-node__body--picker">
      <!-- <div class="video-node__hero-play">▶</div> -->
      <!-- <p class="video-node__try">尝试：</p>
      <button
        v-for="action in VIDEO_PICKER_ACTIONS"
        :key="action.key"
        type="button"
        class="video-node__action"
        @mousedown.stop
        @click="onPickerAction(action.key)"
      >
        <span class="video-node__action-icon" :data-icon="action.icon" />
        {{ action.label }}
      </button> -->
      <i class="iconfont icon-shipin" style="font-size: 36px; color: black;" />
    </div>

    <div v-else class="video-node__body video-node__body--media">
      <div v-if="data.uploadState === 'uploading'" class="video-node__uploading">
        <span class="video-node__spinner" aria-hidden="true" />
        <span class="video-node__uploading-text">
          上传中 ({{ data.uploadProgress }}%) ...
        </span>
      </div>
      <div v-else-if="data.previewUrl" class="video-node__player">
        <video
          ref="videoRef"
          :key="data.previewUrl"
          class="video-node__video"
          :src="data.previewUrl"
          playsinline
          controls
          preload="metadata"
          @loadedmetadata="onVideoMetadata"
        />
      </div>
      <button
        v-else
        type="button"
        class="video-node__empty"
        @mousedown.stop
        @click.stop="triggerUpload"
      >
        <span class="video-node__hero-play video-node__hero-play--lg">▶</span>
        <span>点击上传视频</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Node } from '@antv/x6'
import type { CanvasNodeData } from '../constants'
import { useNodeDelete } from './useNodeDelete'
import { useNodeConnect } from './useNodeConnect'
import { useCanvasBgTheme } from '../useCanvasBgTheme'

const getNode = inject<() => Node>('getNode')!
const requestCanvasUpload = inject<(nodeId: string) => void>('requestCanvasUpload')
const { removeSelf } = useNodeDelete()
const { onPlusPointerDown } = useNodeConnect()
const { isLightTheme } = useCanvasBgTheme()
const videoRef = ref<HTMLVideoElement | null>(null)

const data = reactive<CanvasNodeData>({
  kind: 'video',
  title: '视频节点',
  mode: 'picker',
  content: '',
  uploadState: 'idle',
  uploadProgress: 0,
  mediaWidth: 0,
  mediaHeight: 0,
  previewUrl: '',
  fileName: '',
})

function syncData() {
  getNode().setData({ ...data })
}

function triggerUpload() {
  requestCanvasUpload?.(getNode().id)
}

function onVideoMetadata(event: Event) {
  const video = event.target as HTMLVideoElement
  if (!video.videoWidth || !video.videoHeight) return
  if (data.mediaWidth === video.videoWidth && data.mediaHeight === video.videoHeight) return
  data.mediaWidth = video.videoWidth
  data.mediaHeight = video.videoHeight
  syncData()
}

onMounted(() => {
  const node = getNode()
  Object.assign(data, node.getData() as CanvasNodeData)
  node.on('change:data', ({ current }) => {
    Object.assign(data, current as CanvasNodeData)
  })
})

onBeforeUnmount(() => {
  videoRef.value?.pause()
})
</script>

<style scoped lang="scss">
@import './node-delete.scss';
@import './node-port-plus.scss';
@import './node-light-theme.scss';
.video-node {
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

.video-node--picker-card {
  .video-node__body--picker {
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .video-node__hero-play {
    margin: 0;
  }
}

.video-node__meta {
  margin-bottom: 6px;
  font-size: 12px;
}

.video-node__title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  color: #9ca3af;
}

.video-node__title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-node__play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #3d3d45;
  font-size: 8px;
  color: #d1d5db;
}

.video-node__size {
  color: #6b7280;
  font-size: 11px;
}

.video-node__upload-btn {
  position: absolute;
  top: -36px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  border: 1px solid #3d3d45;
  border-radius: 8px;
  background: #252528;
  color: #e5e7eb;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    border-color: #6b7cff;
  }
}

.video-node__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #4b4b55;
  border-radius: 14px;
  background: #1e1e22;
  overflow: hidden;
}

.video-node__body--picker {
  padding: 16px 12px;
}

.video-node__body--media {
  align-items: stretch;
  justify-content: center;
  gap: 12px;
  padding: 0;
  color: #9ca3af;
  font-size: 14px;
}

.video-node__uploading {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}

.video-node__uploading-text {
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
}

.video-node__player {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  background: #0a0a0c;
}

.video-node__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #0a0a0c;
}

.video-node__empty {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 16px 12px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;

  &:hover {
    color: #e5e7eb;
  }
}

.video-node__hero-play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  font-size: 18px;
  color: #d1d5db;

  &--lg {
    width: 72px;
    height: 72px;
    font-size: 28px;
    margin: 0;
  }
}

.video-node__try {
  margin: 0 0 8px;
  font-size: 12px;
  color: #6b7280;
}

.video-node__action {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-bottom: 6px;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #e5e7eb;
  font-size: 13px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
  }
}

.video-node__action-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #3d3d45;
  flex-shrink: 0;
}

.video-node__spinner {
  width: 28px;
  height: 28px;
  border: 2px solid #3d3d45;
  border-top-color: #6b7cff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
