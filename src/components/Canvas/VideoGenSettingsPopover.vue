<template>
  <div class="video-gen-settings">
    <div class="video-gen-settings__head">
      <p class="video-gen-settings__title video-gen-settings__title--head">
        {{ VIDEO_GEN_ASPECT_RATIO_LABEL }}
      </p>
      <button
        type="button"
        class="video-gen-settings__close"
        title="关闭"
        @click="emit('close')"
      >
        ×
      </button>
    </div>

    <section class="video-gen-settings__section video-gen-settings__section--ratio">
      <div class="video-gen-settings__ratio-grid">
        <button
          v-for="ratio in VIDEO_GEN_ASPECT_RATIOS"
          :key="ratio.key"
          type="button"
          class="video-gen-settings__ratio"
          :class="{ 'video-gen-settings__ratio--active': aspectRatio === ratio.key }"
          @click="aspectRatio = ratio.key"
        >
          <span
            class="video-gen-settings__ratio-preview"
            :class="{ 'video-gen-settings__ratio-preview--auto': ratio.key === 'auto' }"
            :style="{
              width: `${ratio.preview.width}px`,
              height: `${ratio.preview.height}px`,
            }"
            aria-hidden="true"
          />
          <span class="video-gen-settings__ratio-label">{{ ratio.label }}</span>
        </button>
      </div>
    </section>

    <section class="video-gen-settings__section">
      <p class="video-gen-settings__title">{{ VIDEO_GEN_RESOLUTION_LABEL }}</p>
      <div class="video-gen-settings__resolution-grid">
        <button
          v-for="item in VIDEO_GEN_RESOLUTIONS"
          :key="item"
          type="button"
          class="video-gen-settings__chip"
          :class="{ 'video-gen-settings__chip--active': resolution === item }"
          @click="resolution = item"
        >
          {{ item }}
        </button>
      </div>
    </section>

    <section class="video-gen-settings__section">
      <p class="video-gen-settings__title">{{ VIDEO_GEN_DURATION_LABEL }}</p>
      <div class="video-gen-settings__duration-row">
        <input
          v-model.number="duration"
          class="video-gen-settings__duration-slider"
          type="range"
          :min="VIDEO_GEN_DURATIONS[0]"
          :max="VIDEO_GEN_DURATIONS[VIDEO_GEN_DURATIONS.length - 1]"
          step="1"
        />
        <span class="video-gen-settings__duration-value">{{ duration }}s</span>
      </div>
    </section>

    <section class="video-gen-settings__section">
      <p class="video-gen-settings__title">
        {{ VIDEO_GEN_AUDIO_LABEL }}
        <span class="video-gen-settings__help" title="开启后将生成配套音频">?</span>
      </p>
      <div class="video-gen-settings__audio-grid">
        <button
          type="button"
          class="video-gen-settings__chip video-gen-settings__chip--wide"
          :class="{ 'video-gen-settings__chip--active': generateAudio }"
          @click="generateAudio = true"
        >
          开启
        </button>
        <button
          type="button"
          class="video-gen-settings__chip video-gen-settings__chip--wide"
          :class="{ 'video-gen-settings__chip--active': !generateAudio }"
          @click="generateAudio = false"
        >
          关闭
        </button>
      </div>
    </section>

    <div class="video-gen-settings__summary">
      <span
        class="video-gen-settings__summary-icon"
        :class="{ 'video-gen-settings__summary-icon--auto': aspectRatio === 'auto' }"
        aria-hidden="true"
      />
      <span>{{ settingsSummary }}</span>
      <span v-if="generateAudio" class="video-gen-settings__summary-audio" aria-hidden="true">🔊</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  VIDEO_GEN_ASPECT_RATIO_LABEL,
  VIDEO_GEN_ASPECT_RATIOS,
  VIDEO_GEN_AUDIO_LABEL,
  VIDEO_GEN_DURATION_LABEL,
  VIDEO_GEN_DURATIONS,
  VIDEO_GEN_RESOLUTION_LABEL,
  VIDEO_GEN_RESOLUTIONS,
  formatVideoGenSettings,
  type VideoGenAspectRatio,
  type VideoGenDuration,
  type VideoGenResolution,
} from './constants'

const props = withDefaults(
  defineProps<{
    duration?: VideoGenDuration
    aspectRatio?: VideoGenAspectRatio
    resolution?: VideoGenResolution
    generateAudio?: boolean
  }>(),
  {
    duration: 5,
    aspectRatio: '16:9',
    resolution: '720P',
    generateAudio: true,
  },
)

const emit = defineEmits<{
  'update:duration': [value: VideoGenDuration]
  'update:aspectRatio': [value: VideoGenAspectRatio]
  'update:resolution': [value: VideoGenResolution]
  'update:generateAudio': [value: boolean]
  close: []
}>()

const duration = computed({
  get: () => props.duration,
  set: (value: number) => {
    const clamped = Math.min(
      VIDEO_GEN_DURATIONS[VIDEO_GEN_DURATIONS.length - 1],
      Math.max(VIDEO_GEN_DURATIONS[0], Math.round(value)),
    ) as VideoGenDuration
    emit('update:duration', clamped)
  },
})

const aspectRatio = computed({
  get: () => props.aspectRatio,
  set: (value: VideoGenAspectRatio) => emit('update:aspectRatio', value),
})

const resolution = computed({
  get: () => props.resolution,
  set: (value: VideoGenResolution) => emit('update:resolution', value),
})

const generateAudio = computed({
  get: () => props.generateAudio,
  set: (value: boolean) => emit('update:generateAudio', value),
})

const settingsSummary = computed(() =>
  formatVideoGenSettings(duration.value, aspectRatio.value, resolution.value),
)
</script>

<style scoped lang="scss">
.video-gen-settings {
  position: relative;
  width: 300px;
  padding: 12px 12px 0;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.video-gen-settings__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.video-gen-settings__close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
    color: #374151;
  }
}

.video-gen-settings__section--ratio {
  margin-top: 0;
}

.video-gen-settings__section + .video-gen-settings__section {
  margin-top: 14px;
}

.video-gen-settings__title--head {
  margin-bottom: 0;
}

.video-gen-settings__title {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 10px;
  color: #374151;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.video-gen-settings__help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #f3f4f6;
  color: #9ca3af;
  font-size: 10px;
  font-weight: 500;
  cursor: help;
}

.video-gen-settings__ratio-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.video-gen-settings__ratio {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 54px;
  padding: 8px 4px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #374151;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }

  &--active {
    border-color: #111827;
    color: #111827;
    background: #f9fafb;
  }
}

.video-gen-settings__ratio-preview {
  display: block;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  opacity: 0.85;

  &--auto {
    border-style: dashed;
    border-radius: 4px;
  }
}

.video-gen-settings__ratio-label {
  font-size: 11px;
  line-height: 1;
}

.video-gen-settings__resolution-grid,
.video-gen-settings__audio-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.video-gen-settings__audio-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.video-gen-settings__chip {
  padding: 8px 0;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }

  &--active {
    border-color: #111827;
    color: #111827;
    background: #f9fafb;
  }

  &--wide {
    min-width: 0;
  }
}

.video-gen-settings__duration-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.video-gen-settings__duration-slider {
  flex: 1;
  height: 4px;
  margin: 0;
  accent-color: #111827;
  cursor: pointer;
}

.video-gen-settings__duration-value {
  flex-shrink: 0;
  min-width: 28px;
  color: #374151;
  font-size: 12px;
  text-align: right;
}

.video-gen-settings__summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 14px -12px 0;
  padding: 10px 12px;
  border-top: 1px solid #f3f4f6;
  background: #f9fafb;
  color: #374151;
  font-size: 12px;
  line-height: 1;
}

.video-gen-settings__summary-icon {
  width: 14px;
  height: 8px;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  opacity: 0.85;

  &--auto {
    width: 12px;
    height: 12px;
    border-style: dashed;
    border-radius: 3px;
  }
}

.video-gen-settings__summary-audio {
  font-size: 11px;
}
</style>
