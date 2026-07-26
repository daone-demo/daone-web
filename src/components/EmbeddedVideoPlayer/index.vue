<template>
  <div
    class="embedded-video-player"
    :class="{
      'embedded-video-player--contain': objectFit === 'contain',
    }"
    :style="rootStyle"
    @mousedown.stop
    @click.stop
  >
    <video
      ref="videoRef"
      :key="src"
      class="embedded-video-player__video"
      :src="src"
      playsinline
      preload="metadata"
      @loadedmetadata="onLoadedMetadata"
      @timeupdate="onTimeUpdate"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
    />

    <div class="video-controls-bar">
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatVideoTime, useVideoPlayer } from '@components/Canvas/nodes/useVideoPlayer'

const props = withDefaults(defineProps<{
  src: string
  objectFit?: 'cover' | 'contain'
  aspectRatio?: string
  minHeight?: string
}>(), {
  objectFit: 'cover',
  aspectRatio: '16 / 9',
  minHeight: '0px',
})

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
  toggleMute,
  toggleFullscreen,
} = useVideoPlayer(videoRef)

const formatTime = formatVideoTime

const rootStyle = computed(() => ({
  aspectRatio: props.aspectRatio,
  minHeight: props.minHeight,
}))

function onProgressInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  seek(value)
}
</script>

<style scoped lang="scss">
.embedded-video-player {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
  background: #111;
}

.embedded-video-player--contain {
  .embedded-video-player__video {
    object-fit: contain;
  }
}

.embedded-video-player__video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  background: #111;
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
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
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
</style>
