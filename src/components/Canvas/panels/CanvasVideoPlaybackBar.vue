<template>
  <div
    class="canvas-video-playback"
    @mousedown.stop
    @click.stop
  >
    <div class="canvas-video-playback__inner">
      <button
        type="button"
        class="canvas-video-playback__btn"
        :title="isPlaying ? '暂停' : '播放'"
        @click="emit('toggle-play')"
      >
        <span aria-hidden="true">{{ isPlaying ? '❚❚' : '▶' }}</span>
      </button>

      <span class="canvas-video-playback__time">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>

      <input
        class="canvas-video-playback__slider"
        type="range"
        min="0"
        :max="duration || 0"
        step="0.1"
        :value="currentTime"
        @input="onSeekInput"
      />

      <button
        type="button"
        class="canvas-video-playback__btn"
        :title="isMuted ? '取消静音' : '静音'"
        @click="emit('toggle-mute')"
      >
        <span aria-hidden="true">{{ isMuted ? '🔇' : '🔊' }}</span>
      </button>

      <button
        type="button"
        class="canvas-video-playback__btn"
        title="全屏"
        @click="emit('toggle-fullscreen')"
      >
        <span aria-hidden="true">⛶</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatVideoTime } from '../nodes/useVideoPlayer'

const props = defineProps<{
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  duration: number
}>()

const emit = defineEmits<{
  'toggle-play': []
  'toggle-mute': []
  'toggle-fullscreen': []
  seek: [time: number]
}>()

const formatTime = formatVideoTime

function onSeekInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  emit('seek', value)
}
</script>

<style scoped lang="scss">
.canvas-video-playback {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 1200;
  transform: translateX(-50%);
  width: min(720px, calc(100vw - 48px));
  pointer-events: auto;
}

.canvas-video-playback__inner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(18, 18, 22, 0.94);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(8px);
}

.canvas-video-playback__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #fff;
  font-size: 14px;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}

.canvas-video-playback__time {
  flex-shrink: 0;
  min-width: 84px;
  color: #f3f4f6;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.canvas-video-playback__slider {
  flex: 1;
  height: 4px;
  margin: 0;
  appearance: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border: none;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: none;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }
}
</style>
