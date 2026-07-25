<template>
  <div
    class="video-node"
    :class="{
      'video-node--selected': data.isSelected,
      'video-node--light': isLightTheme,
      'video-node--picker-card': data.mode === 'picker',
      'video-node--playing': isPlayerOpen,
      'video-node--info-card': showInfoCard,
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
      v-if="!showInfoCard && !isPlayerOpen"
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
      v-else-if="showInfoCard"
      class="video-node__body video-node__body--info"
    >
      <video
        ref="videoRef"
        :key="`meta-${data.previewUrl}`"
        class="video-node__video-hidden"
        :src="data.previewUrl"
        playsinline
        preload="metadata"
        @loadedmetadata="onVideoLoadedMetadata"
      />

      <button
        type="button"
        class="video-node__info-close"
        title="删除节点"
        @mousedown.stop
        @click.stop="removeSelf"
      >
        ×
      </button>

      <span class="video-node__info-handle" aria-hidden="true">
        <i /><i /><i />
      </span>

      <div class="video-node__info-rows">
        <div class="video-node__info-row">
          <span class="video-node__info-icon video-node__info-icon--file" aria-hidden="true" />
          <span class="video-node__info-text" :title="rawFileName">{{ displayFileName }}</span>
        </div>
        <div class="video-node__info-row">
          <span class="video-node__info-icon video-node__info-icon--resolution" aria-hidden="true" />
          <span>{{ resolutionLabel }}</span>
        </div>
        <div class="video-node__info-row">
          <span class="video-node__info-icon video-node__info-icon--duration" aria-hidden="true" />
          <span>{{ durationLabel }}</span>
        </div>
      </div>

      <button
        type="button"
        class="video-node__info-play"
        title="播放"
        @mousedown.stop
        @click.stop="startPlayback"
      >
        <span class="video-node__info-play-icon" aria-hidden="true" />
      </button>
    </div>

    <div
      v-else-if="isPlayerOpen && data.previewUrl"
      class="video-node__body video-node__body--playing"
    >
      <video
        ref="videoRef"
        :key="`play-${data.previewUrl}`"
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
        title="关闭播放"
        @mousedown.stop
        @click.stop="stopPlayback"
      >
        ×
      </button>

      <div class="video-node__controls" @mousedown.stop @click.stop>
        <div class="video-node__controls-top">
          <button
            type="button"
            class="video-node__control-btn"
            :title="isPlaying ? '暂停' : '播放'"
            @click="togglePlay"
          >
            <span aria-hidden="true">{{ isPlaying ? '❚❚' : '▶' }}</span>
          </button>
          <button
            type="button"
            class="video-node__control-btn"
            :title="isMuted ? '取消静音' : '静音'"
            @click="toggleMute"
          >
            <span aria-hidden="true">{{ isMuted ? '🔇' : '🔊' }}</span>
          </button>
          <button
            type="button"
            class="video-node__control-btn video-node__control-btn--more"
            title="更多"
          >
            <span aria-hidden="true">⋮</span>
          </button>
        </div>
        <input
          class="video-node__progress"
          type="range"
          min="0"
          :max="duration || 0"
          step="0.1"
          :value="currentTime"
          @input="onProgressInput"
        />
      </div>
    </div>

    <div v-else class="video-node__body video-node__body--media">
      <div v-if="data.uploadState === 'uploading'" class="video-node__uploading">
        <span class="video-node__spinner" aria-hidden="true" />
        <span class="video-node__uploading-text">
          上传中 ({{ data.uploadProgress }}%) ...
        </span>
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

    <Teleport to="body">
      <CanvasVideoPlaybackBar
        v-if="isPlayerOpen && data.previewUrl"
        :is-playing="isPlaying"
        :is-muted="isMuted"
        :current-time="currentTime"
        :duration="duration"
        @toggle-play="togglePlay"
        @toggle-mute="toggleMute"
        @toggle-fullscreen="toggleFullscreen"
        @seek="seek"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Node } from '@antv/x6'
import type { CanvasNodeData } from '../constants'
import CanvasVideoPlaybackBar from '../panels/CanvasVideoPlaybackBar.vue'
import { useNodeDelete } from './useNodeDelete'
import { useNodeConnect } from './useNodeConnect'
import { useCanvasBgTheme } from '../useCanvasBgTheme'
import { syncNodeViewData } from './syncNodeViewData'
import {
  formatVideoTime,
  getVideoResolutionLabel,
  useVideoPlayer,
} from './useVideoPlayer'

const getNode = inject<() => Node>('getNode')!
const requestCanvasUpload = inject<(nodeId: string) => void>('requestCanvasUpload')
const { removeSelf } = useNodeDelete()
const { onPlusPointerDown } = useNodeConnect()
const { isLightTheme } = useCanvasBgTheme()
const videoRef = ref<HTMLVideoElement | null>(null)
const isPlayerOpen = ref(false)

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
  play,
  togglePlay,
  seek,
  toggleMute,
  toggleFullscreen,
  stop,
  formatTime,
} = useVideoPlayer(videoRef)

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

const showInfoCard = computed(
  () => Boolean(data.previewUrl) && !isPlayerOpen.value,
)

const rawFileName = computed(() => data.fileName || data.title || '未命名视频')

const displayFileName = computed(() => {
  const name = rawFileName.value
  if (name.length <= 12) return name
  const dot = name.lastIndexOf('.')
  if (dot > 0) {
    const base = name.slice(0, dot)
    const ext = name.slice(dot)
    if (base.length > 6) return `${base.slice(0, 6)}....${ext}`
  }
  return `${name.slice(0, 6)}....${name.slice(-4)}`
})

const resolutionLabel = computed(() => getVideoResolutionLabel(data.mediaHeight))

const durationLabel = computed(() => {
  if (data.durationSeconds && data.durationSeconds > 0) {
    return formatVideoTime(data.durationSeconds)
  }
  if (duration.value > 0) {
    return formatTime(duration.value)
  }
  return '--'
})

function syncData() {
  getNode().setData({ ...data })
}

function triggerUpload() {
  requestCanvasUpload?.(getNode().id)
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

async function startPlayback() {
  isPlayerOpen.value = true
  await nextTick()
  void play()
}

function stopPlayback() {
  stop()
  isPlayerOpen.value = false
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
  stopPlayback()
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

.video-node--info-card {
  .node-port-plus {
    right: -5px;
    width: 24px;
    height: 24px;
    border: 1px solid #d1d5db;
    background: #fff;
    color: #9ca3af;
    font-size: 16px;
    font-weight: 300;
    opacity: 1;
  }
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

.video-node__body--info {
  position: relative;
  border: none;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 2px 16px rgba(15, 23, 42, 0.1);
  overflow: visible;
}

.video-node__body--picker {
  padding: 16px 12px;
}

.video-node__body--media,
.video-node__body--playing {
  align-items: stretch;
  justify-content: center;
  padding: 0;
  color: #9ca3af;
  font-size: 14px;
}

.video-node__body--playing {
  position: relative;
  border-color: #4b4b55;
  background: #111;
  overflow: hidden;
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

.video-node__video-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.video-node__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #111;
}

.video-node__info-close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #52525b;
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #3f3f46;
  }
}

.video-node__info-handle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 14px auto 18px;
  color: #9ca3af;

  i {
    display: block;
    width: 18px;
    height: 2px;
    border-radius: 999px;
    background: #c4c8d0;
  }
}

.video-node__info-rows {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-start;
  gap: 12px;
  padding: 0 16px 52px;
}

.video-node__info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
  line-height: 1.3;
  color: #4b5563;
}

.video-node__info-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: #eceef2;

  &--file::before {
    content: '▣';
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 10px;
    color: #8b93a1;
  }

  &--resolution::before {
    content: 'HD';
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 7px;
    font-weight: 700;
    color: #8b93a1;
  }

  &--duration::before {
    content: '⏱';
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 10px;
    color: #8b93a1;
  }
}

.video-node__info-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-node__info-play {
  position: absolute;
  right: 14px;
  bottom: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);

  &:hover {
    background: #2563eb;
  }
}

.video-node__info-play-icon {
  width: 0;
  height: 0;
  margin-left: 2px;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 9px solid #fff;
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
  font-size: 16px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: rgba(17, 24, 39, 0.9);
  }
}

.video-node__controls {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 28px 10px 10px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.78) 100%);
}

.video-node__controls-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.video-node__control-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #fff;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  &--more {
    margin-left: auto;
    font-size: 14px;
  }
}

.video-node__progress {
  width: 100%;
  height: 3px;
  margin: 0;
  appearance: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.28);
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 10px;
    height: 10px;
    border: none;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border: none;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }
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
