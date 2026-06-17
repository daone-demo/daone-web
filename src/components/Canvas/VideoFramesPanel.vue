<template>
  <div class="video-frames-panel">
    <div class="video-frames-panel__seek">
      <input
        v-model.number="currentTime"
        class="video-frames-panel__slider"
        type="range"
        min="0"
        :max="duration"
        step="0.1"
      />
      <span class="video-frames-panel__time">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>
    </div>

    <div class="video-frames-panel__controls">
      <div class="video-frames-panel__playback">
        <button type="button" class="video-frames-panel__icon-btn" title="上一帧" @click="stepBackward">
          <span aria-hidden="true">&lt;</span>
        </button>
        <button
          type="button"
          class="video-frames-panel__icon-btn"
          :title="playing ? '暂停' : '播放'"
          @click="togglePlay"
        >
          <span aria-hidden="true">{{ playing ? '❚❚' : '▶' }}</span>
        </button>
        <button type="button" class="video-frames-panel__icon-btn" title="下一帧" @click="stepForward">
          <span aria-hidden="true">&gt;</span>
        </button>
      </div>

      <span class="video-frames-panel__divider" aria-hidden="true" />

      <div class="video-frames-panel__actions">
        <button type="button" class="video-frames-panel__action" @click="emit('add-single')">
          + 单帧
        </button>
        <button type="button" class="video-frames-panel__action" @click="emit('add-multiple')">
          + 多帧
        </button>
      </div>

      <button type="button" class="video-frames-panel__undo" title="撤销" @click="emit('undo')">
        <span class="video-frames-panel__undo-icon" aria-hidden="true" />
        撤销
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    duration?: number
  }>(),
  {
    duration: 26,
  },
)

const emit = defineEmits<{
  'add-single': []
  'add-multiple': []
  undo: []
}>()

const currentTime = ref(0)
const playing = ref(false)
let playTimer: number | undefined

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const remain = Math.floor(safe % 60)
  return `${minutes}:${remain.toString().padStart(2, '0')}`
}

function clearPlayTimer() {
  if (playTimer !== undefined) {
    window.clearInterval(playTimer)
    playTimer = undefined
  }
}

function togglePlay() {
  playing.value = !playing.value
}

function stepBackward() {
  playing.value = false
  currentTime.value = Math.max(0, Number((currentTime.value - 0.1).toFixed(1)))
}

function stepForward() {
  playing.value = false
  currentTime.value = Math.min(props.duration, Number((currentTime.value + 0.1).toFixed(1)))
}

watch(playing, (value) => {
  clearPlayTimer()
  if (!value) return

  playTimer = window.setInterval(() => {
    if (currentTime.value >= props.duration) {
      currentTime.value = props.duration
      playing.value = false
      return
    }
    currentTime.value = Number((currentTime.value + 0.1).toFixed(1))
  }, 100)
})

watch(
  () => props.duration,
  (value) => {
    if (currentTime.value > value) {
      currentTime.value = value
    }
  },
)

onBeforeUnmount(() => {
  clearPlayTimer()
})
</script>

<style scoped lang="scss">
.video-frames-panel {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #3d3d45;
  border-radius: 14px;
  background: #2b2c2f;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
}

.video-frames-panel__seek {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.video-frames-panel__slider {
  flex: 1;
  height: 4px;
  margin: 0;
  appearance: none;
  border-radius: 999px;
  background: #4b4c50;
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border: none;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: none;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }
}

.video-frames-panel__time {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 8px;
  background: #1f2023;
  color: #d1d5db;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}

.video-frames-panel__controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.video-frames-panel__playback,
.video-frames-panel__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.video-frames-panel__icon-btn,
.video-frames-panel__undo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #4b4c50;
  border-radius: 8px;
  background: #34353a;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #3d3e44;
  }
}

.video-frames-panel__divider {
  width: 1px;
  height: 24px;
  background: #4b4c50;
}

.video-frames-panel__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: #2d6d44;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #358052;
  }
}

.video-frames-panel__undo {
  margin-left: auto;
  gap: 4px;
  padding: 0 10px;
  font-size: 12px;
}

.video-frames-panel__undo-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%23d1d5db' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M4.5 4.5H2.5V2.5M2.5 4.5A4.5 4.5 0 1 1 2.5 9.5'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}
</style>
