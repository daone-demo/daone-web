<template>
  <div class="video-storyboard-panel">
    <div class="video-storyboard-panel__head">
      <h3 class="video-storyboard-panel__title">{{ VIDEO_STORYBOARD_TITLE }}</h3>
      <button type="button" class="video-storyboard-panel__close" title="关闭" @click="emit('close')">
        ×
      </button>
    </div>

    <div class="video-storyboard-panel__section">
      <p class="video-storyboard-panel__label">{{ VIDEO_STORYBOARD_DURATION_LABEL }}</p>
      <div class="video-storyboard-panel__durations">
        <button
          v-for="duration in VIDEO_STORYBOARD_DURATIONS"
          :key="duration"
          type="button"
          class="video-storyboard-panel__duration"
          :class="{ 'video-storyboard-panel__duration--active': durationValue === duration }"
          @click="durationValue = duration"
        >
          {{ duration }}s
        </button>
      </div>
    </div>

    <div class="video-storyboard-panel__section">
      <div class="video-storyboard-panel__desc-head">
        <p class="video-storyboard-panel__label">{{ VIDEO_STORYBOARD_DESC_LABEL }}</p>
        <button type="button" class="video-storyboard-panel__ai-edit">
          <span class="video-storyboard-panel__ai-edit-icon" aria-hidden="true" />
          AI编辑
        </button>
      </div>
      <textarea
        v-model="descriptionValue"
        class="video-storyboard-panel__textarea"
        :placeholder="VIDEO_STORYBOARD_DESC_PLACEHOLDER"
        rows="4"
      />
    </div>

    <div class="video-storyboard-panel__footer">
      <div class="video-storyboard-panel__ratio-wrap">
        <button
          type="button"
          class="video-storyboard-panel__ratio"
          @click="toggleRatioMenu"
        >
          比例 {{ ratioValue }}
          <span class="video-storyboard-panel__ratio-arrow" aria-hidden="true" />
        </button>
        <div v-if="showRatioMenu" class="video-storyboard-panel__ratio-menu">
          <button
            v-for="ratio in VIDEO_STORYBOARD_RATIOS"
            :key="ratio"
            type="button"
            class="video-storyboard-panel__ratio-item"
            :class="{ 'video-storyboard-panel__ratio-item--active': ratioValue === ratio }"
            @click="selectRatio(ratio)"
          >
            {{ ratio }}
          </button>
        </div>
      </div>
      <div class="video-storyboard-panel__actions">
        <button type="button" class="video-storyboard-panel__btn video-storyboard-panel__btn--ghost" @click="emit('cancel')">
          取消
        </button>
        <button type="button" class="video-storyboard-panel__btn video-storyboard-panel__btn--primary" @click="emit('confirm')">
          确认
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  VIDEO_STORYBOARD_DESC_LABEL,
  VIDEO_STORYBOARD_DESC_PLACEHOLDER,
  VIDEO_STORYBOARD_DURATION_LABEL,
  VIDEO_STORYBOARD_DURATIONS,
  VIDEO_STORYBOARD_RATIOS,
  VIDEO_STORYBOARD_TITLE,
  type VideoStoryboardDuration,
  type VideoStoryboardRatio,
} from './constants'

const props = withDefaults(
  defineProps<{
    duration?: VideoStoryboardDuration
    description?: string
    ratio?: VideoStoryboardRatio
  }>(),
  {
    duration: 5,
    description: '',
    ratio: '16:9',
  },
)

const emit = defineEmits<{
  'update:duration': [value: VideoStoryboardDuration]
  'update:description': [value: string]
  'update:ratio': [value: VideoStoryboardRatio]
  close: []
  cancel: []
  confirm: []
}>()

const showRatioMenu = ref(false)

const durationValue = computed({
  get: () => props.duration,
  set: (value: VideoStoryboardDuration) => emit('update:duration', value),
})

const descriptionValue = computed({
  get: () => props.description,
  set: (value: string) => emit('update:description', value),
})

const ratioValue = computed({
  get: () => props.ratio,
  set: (value: VideoStoryboardRatio) => emit('update:ratio', value),
})

function toggleRatioMenu() {
  showRatioMenu.value = !showRatioMenu.value
}

function selectRatio(ratio: VideoStoryboardRatio) {
  ratioValue.value = ratio
  showRatioMenu.value = false
}
</script>

<style scoped lang="scss">
.video-storyboard-panel {
  width: 360px;
  padding: 16px 18px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
}

.video-storyboard-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.video-storyboard-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.video-storyboard-panel__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
    color: #6b7280;
  }
}

.video-storyboard-panel__section + .video-storyboard-panel__section {
  margin-top: 18px;
}

.video-storyboard-panel__label {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.video-storyboard-panel__durations {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.video-storyboard-panel__duration {
  padding: 8px 0;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;

  &:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  &--active {
    border-color: #60a5fa;
    background: #eff6ff;
    color: #2563eb;
  }
}

.video-storyboard-panel__desc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;

  .video-storyboard-panel__label {
    margin-bottom: 0;
  }
}

.video-storyboard-panel__ai-edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: #1d4ed8;
  }
}

.video-storyboard-panel__ai-edit-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%232563eb' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M3 10.5V13h2.5L12.5 6 10 3.5z'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}

.video-storyboard-panel__textarea {
  width: 100%;
  min-height: 96px;
  padding: 12px 14px;
  border: 1px solid #eef0f3;
  border-radius: 12px;
  background: #fafafa;
  color: #111827;
  font-size: 13px;
  line-height: 1.55;
  resize: none;
  outline: none;
  box-sizing: border-box;

  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    border-color: #d1d5db;
    background: #fff;
  }
}

.video-storyboard-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}

.video-storyboard-panel__ratio-wrap {
  position: relative;
}

.video-storyboard-panel__ratio {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }
}

.video-storyboard-panel__ratio-arrow {
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 3.75 5 6.25 7.5 3.75'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.video-storyboard-panel__ratio-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 2;
  min-width: 88px;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.video-storyboard-panel__ratio-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 12px;
  line-height: 1;
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    background: #f3f4f6;
  }
}

.video-storyboard-panel__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.video-storyboard-panel__btn {
  min-width: 72px;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;

  &--ghost {
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #374151;

    &:hover {
      background: #f9fafb;
    }
  }

  &--primary {
    border: 1px solid #111827;
    background: #111827;
    color: #fff;

    &:hover {
      background: #1f2937;
      border-color: #1f2937;
    }
  }
}
</style>
