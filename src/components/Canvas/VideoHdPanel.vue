<template>
  <div class="video-hd-panel">
    <div class="video-hd-panel__head">
      <h3 class="video-hd-panel__title">{{ VIDEO_HD_TITLE }}</h3>
      <button type="button" class="video-hd-panel__close" title="关闭" @click="emit('close')">
        ×
      </button>
    </div>

    <div class="video-hd-panel__section">
      <p class="video-hd-panel__label">{{ VIDEO_HD_MAGNIFICATION_LABEL }}</p>
      <div class="video-hd-panel__options">
        <button
          v-for="option in VIDEO_HD_MAGNIFICATIONS"
          :key="option"
          type="button"
          class="video-hd-panel__option"
          :class="{ 'video-hd-panel__option--active': modelValue === option }"
          @click="emit('update:modelValue', option)"
        >
          {{ option }}
        </button>
      </div>
      <p class="video-hd-panel__hint">{{ VIDEO_HD_HINT }}</p>
    </div>

    <div class="video-hd-panel__footer">
      <button type="button" class="video-hd-panel__btn video-hd-panel__btn--ghost" @click="emit('cancel')">
        取消
      </button>
      <button type="button" class="video-hd-panel__btn video-hd-panel__btn--primary" @click="emit('start')">
        开始高清
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  VIDEO_HD_HINT,
  VIDEO_HD_MAGNIFICATION_LABEL,
  VIDEO_HD_MAGNIFICATIONS,
  VIDEO_HD_TITLE,
  type VideoHdMagnification,
} from './constants'

defineProps<{
  modelValue: VideoHdMagnification
}>()

const emit = defineEmits<{
  'update:modelValue': [value: VideoHdMagnification]
  close: []
  cancel: []
  start: []
}>()
</script>

<style scoped lang="scss">
.video-hd-panel {
  width: 100%;
  padding: 16px 18px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
}

.video-hd-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.video-hd-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.video-hd-panel__close {
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

.video-hd-panel__section {
  margin-bottom: 18px;
}

.video-hd-panel__label {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.video-hd-panel__options {
  display: flex;
  gap: 10px;
}

.video-hd-panel__option {
  flex: 1;
  min-width: 0;
  padding: 10px 0;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;

  &:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  &--active {
    border-color: #111827;
    background: #fff;
    color: #111827;
  }
}

.video-hd-panel__hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #9ca3af;
}

.video-hd-panel__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.video-hd-panel__btn {
  min-width: 88px;
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
