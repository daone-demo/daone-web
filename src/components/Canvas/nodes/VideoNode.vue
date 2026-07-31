<template>
  <div
    class="video-node"
    :class="{
      'video-node--selected': data.isSelected,
      'video-node--light': isLightTheme,
      'video-node--picker-card': data.mode === 'picker',
      'video-node--generating': isVideoGenerating,
      'video-node--preview': hasVideoPreview,
      'video-node--uploading': data.uploadState === 'uploading',
    }"
    @dblclick.stop="onVideoNodeDblClick"
  >
    <button
      type="button"
      class="node-port-plus"
      :style="portPlusStyle"
      title="添加连线节点"
      @mousedown.stop="onPlusPointerDown"
    >
      +
    </button>

    <button
      v-if="!hasVideoPreview && !isFileUploading"
      type="button"
      class="canvas-node__delete-float"
      title="删除节点"
      @mousedown.stop
      @click="removeSelf"
    >
      ×
    </button>

    <button
      v-if="data.mode === 'picker'"
      type="button"
      class="video-node__upload-btn"
      @mousedown.stop
      @click="triggerUpload"
    >
      ↑ 上传
    </button>

    <div
      v-if="data.mode === 'picker'"
      class="video-node__body video-node__body--picker"
    >
      <i class="iconfont icon-shipin" style="font-size: 36px; color: black;" />
    </div>

    <div
      v-else-if="isVideoGenerating"
      class="video-node__body video-node__body--generating"
    >
      <div class="video-node__generating">
        <div class="video-node__generating-preview">
          <span class="video-node__spinner" aria-hidden="true" />
          <p class="video-node__generating-text">{{ genProgressText }}</p>
        </div>
      </div>
    </div>

    <div
      v-else-if="hasVideoPreview"
      class="video-node__body video-node__body--preview"
    >
      <video
        ref="videoRef"
        :key="data.previewUrl"
        class="video-node__video"
        :src="data.previewUrl"
        playsinline
        preload="metadata"
        @loadedmetadata="onVideoLoadedMetadata"
        @timeupdate="onTimeUpdate"
        @play="onPlay"
        @pause="onPause"
        @ended="onEnded"
      />

      <button
        type="button"
        class="video-node__close"
        title="删除节点"
        @mousedown.stop
        @click.stop="removeSelf"
      >
        ×
      </button>

      <div
        class="video-controls-bar"
        @mousedown.stop
        @click.stop
      >
        <button
          type="button"
          class="video-ctrl-btn"
          :title="isPlaying ? '暂停' : '播放'"
          @click="togglePlay"
        >
          <svg
            v-if="isPlaying"
            viewBox="0 0 12 12"
            width="12"
            height="12"
            aria-hidden="true"
          >
            <rect x="1.5" y="1" width="3" height="10" rx="0.8" fill="currentColor" />
            <rect x="7.5" y="1" width="3" height="10" rx="0.8" fill="currentColor" />
          </svg>
          <svg
            v-else
            viewBox="0 0 12 12"
            width="12"
            height="12"
            aria-hidden="true"
          >
            <path d="M2.5 1.2 10.5 6 2.5 10.8Z" fill="currentColor" />
          </svg>
        </button>

        <div class="video-ctrl-time">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>

        <input
          class="video-ctrl-range"
          type="range"
          min="0"
          :max="duration || 0"
          step="0.05"
          :value="currentTime"
          @input="onProgressInput"
        >

        <div class="video-ctrl-volume">
          <button
            type="button"
            class="video-ctrl-btn"
            :title="isMuted ? '取消静音' : '音量'"
            @click="toggleMute"
          >
            <svg
              v-if="isMuted"
              viewBox="0 0 16 16"
              width="12"
              height="12"
              aria-hidden="true"
            >
              <path
                d="M8.5 3.2 5.8 5.8H3.2v4.4h2.6l2.7 2.6V3.2ZM11.8 5.2l-.9.9A2.4 2.4 0 0 1 12 8a2.4 2.4 0 0 1-1.1 1.9l.9.9A3.5 3.5 0 0 0 13 8a3.5 3.5 0 0 0-1.2-2.8Z"
                fill="currentColor"
              />
            </svg>
            <svg
              v-else
              viewBox="0 0 16 16"
              width="12"
              height="12"
              aria-hidden="true"
            >
              <path
                d="M8.5 2.8 5.2 5.8H2.5v4.4h2.7l3.3 3V2.8ZM11.4 4.6l-.8.8A2.8 2.8 0 0 1 12 8a2.8 2.8 0 0 1-1.4 2.6l.8.8A3.8 3.8 0 0 0 13 8a3.8 3.8 0 0 0-1.6-3.4ZM9.8 6.2l-.8.8a1 1 0 0 1 0 1.4l.8.8a2 2 0 0 0 0-3Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        <button
          type="button"
          class="video-ctrl-btn"
          title="全屏"
          @click="toggleFullscreen"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path
              d="M2.5 6.2V2.5h3.7M9.8 2.5h3.7v3.7M13.5 9.8v3.7H9.8M6.2 13.5H2.5V9.8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <div v-else class="video-node__body video-node__body--media">
      <div v-if="data.uploadState === 'uploading' && !isVideoGenerating" class="video-node__uploading">
        <span class="video-node__spinner" aria-hidden="true" />
        <span class="video-node__uploading-text">
          上传中 ({{ data.uploadProgress }}%) ...
        </span>
      </div>

      <div
        v-else
        class="video-node__empty"
        @mousedown="onEmptyMouseDown"
      >
        <span class="video-node__hero-play video-node__hero-play--lg">▶</span>
        <span>{{ emptyStateLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Node } from '@antv/x6'
import type { CanvasNodeData } from '../constants'
import { isNodeFileUploading } from '../constants'
import type { CanvasGraph } from '../graph'
import { useNodeDelete } from './useNodeDelete'
import { useNodeConnect } from './useNodeConnect'
import { useNodePortPlusStyle } from './useNodePortPlusStyle'
import { useCanvasBgTheme } from '../useCanvasBgTheme'
import { syncNodeViewData } from './syncNodeViewData'
import { useVideoPlayer, formatVideoTime } from './useVideoPlayer'

const getNode = inject<() => Node>('getNode')!
const requestCanvasUpload = inject<(nodeId: string) => void>('requestCanvasUpload')
const { removeSelf } = useNodeDelete()
const { onPlusPointerDown } = useNodeConnect()
const { portPlusStyle } = useNodePortPlusStyle()
const { isLightTheme } = useCanvasBgTheme()
const videoRef = ref<HTMLVideoElement | null>(null)

const {
  isPlaying,
  currentTime,
  duration,
  isMuted,
  onLoadedMetadata,
  onTimeUpdate,
  onPlay,
  onPause,
  onEnded,
  togglePlay,
  seek,
  pause,
  toggleMute,
  toggleFullscreen,
} = useVideoPlayer(videoRef)

const formatTime = formatVideoTime

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

const isVideoGenerating = computed(
  () =>
    data.uploadState === 'uploading' &&
    (data.generationTaskType === 'VIDEO' || Boolean(data.generationTaskId)),
)

const hasVideoPreview = computed(
  () => Boolean(data.previewUrl?.trim()) && !isVideoGenerating.value,
)

const isFileUploading = computed(() => isNodeFileUploading(data))

const emptyStateLabel = computed(() =>
  data.title === '生成失败' ? '生成失败，点击重试' : '点击上传视频',
)

const genProgressText = computed(() => {
  const progress = data.uploadProgress ?? 0
  if (progress <= 0) return '准备中...'
  if (progress >= 100) return '即将完成...'
  return `${progress}%`
})

function syncData() {
  getNode().setData({ ...data })
}

function triggerUpload() {
  requestCanvasUpload?.(getNode().id)
}

function canvasGraph() {
  return getNode().model?.graph as CanvasGraph | undefined
}

/** 空状态/失败态：拖动移动节点，轻点触发上传或重试 */
function onEmptyMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  event.stopPropagation()

  const node = getNode()
  const g = canvasGraph()
  if (!g) return

  const startClientX = event.clientX
  const startClientY = event.clientY
  const startLocal = g.clientToLocal(startClientX, startClientY)
  const origin = node.getPosition()
  let moved = false

  const onMove = (moveEvent: MouseEvent) => {
    if (!moved && Math.hypot(moveEvent.clientX - startClientX, moveEvent.clientY - startClientY) < 4) {
      return
    }
    moved = true
    const point = g.clientToLocal(moveEvent.clientX, moveEvent.clientY)
    node.position(origin.x + (point.x - startLocal.x), origin.y + (point.y - startLocal.y))
    g.__notifyNodeDragMove?.()
  }

  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    if (moved) {
      g.__notifyNodeDragEnd?.()
      return
    }
    triggerUpload()
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onVideoNodeDblClick() {
  const node = getNode()
  const g = node.model?.graph as CanvasGraph | undefined
  g?.__openVideoDialogue?.(node.id)
}

function onVideoLoadedMetadata(event: Event) {
  onLoadedMetadata()
  const video = event.target as HTMLVideoElement
  let changed = false
  if (video.videoWidth && data.mediaWidth !== video.videoWidth) {
    data.mediaWidth = video.videoWidth
    changed = true
  }
  if (video.videoHeight && data.mediaHeight !== video.videoHeight) {
    data.mediaHeight = video.videoHeight
    changed = true
  }
  if (Number.isFinite(video.duration) && video.duration > 0 && !data.durationSeconds) {
    data.durationSeconds = Math.round(video.duration * 10) / 10
    changed = true
  }
  if (changed) syncData()
}

function onProgressInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  seek(value)
}

onMounted(() => {
  const node = getNode()
  syncNodeViewData(data, node.getData() as CanvasNodeData)
  node.on('change:data', ({ current }) => {
    syncNodeViewData(data, current as CanvasNodeData)
  })
})

onBeforeUnmount(() => {
  pause()
})
</script>

<style scoped lang="scss">
@import './node-glyphs';
@import './node-delete.scss';
@import './node-port-plus.scss';
@import './node-light-theme.scss';
@import './node-generating-bg.scss';

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
  border-radius: 16px;
  background: #1e1e22;
  overflow: hidden;
}

.video-node__body--preview {
  position: relative;
  border: none;
  border-radius: 16px;
  background: #111;
  box-shadow: 0 2px 16px rgba(15, 23, 42, 0.12);
}

.video-node__body--picker {
  padding: 16px 12px;
}

.video-node__body--media,
.video-node__body--generating {
  align-items: stretch;
  justify-content: center;
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

.video-node__generating {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

.video-node__generating-preview {
  @include node-generating-background();
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 140px;
  border-radius: 10px;
  text-align: center;
  color: #8a8a8a;
}

.video-node__generating-text {
  margin: 0;
  font-size: 12px;
  color: #8a8a8a;
  line-height: 1.4;
  white-space: nowrap;
}

.video-node__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  background: #111;
}

.video-node__close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(17, 24, 39, 0.72);
  color: #fff;
  cursor: pointer;

  @include node-icon-close(11px, 1.5px);

  &:hover {
    background: rgba(17, 24, 39, 0.9);
  }
}

.video-controls-bar {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 10px;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  background: #000000b8;
  backdrop-filter: blur(6px);
}

.video-ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #fffffff2;
  cursor: pointer;
  transition: background-color 0.15s, opacity 0.15s;

  svg {
    display: block;
    line-height: 1;
  }

  &:hover {
    background: #ffffff1f;
  }
}

.video-ctrl-time {
  min-width: 72px;
  color: #fffffff2;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.video-ctrl-range {
  flex: 1;
  height: 3px;
  margin: 0;
  accent-color: #fff;
  cursor: pointer;
}

.video-ctrl-volume {
  position: relative;
  display: flex;
  align-items: center;
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
  color: #9ca3af;
  font-size: 14px;
  cursor: grab;
  user-select: none;

  &:active {
    cursor: grabbing;
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
