<template>
  <div class="video-gen-model-picker">
    <button
      v-for="model in VIDEO_GEN_MODELS"
      :key="model.id"
      type="button"
      class="video-gen-model-picker__item"
      :class="{ 'video-gen-model-picker__item--active': modelId === model.id }"
      @click="selectModel(model.id)"
    >
      <span
        class="video-gen-model-picker__icon"
        :data-icon="model.icon"
        aria-hidden="true"
      />
      <span class="video-gen-model-picker__body">
        <span class="video-gen-model-picker__title-row">
          <span class="video-gen-model-picker__name">{{ model.name }}</span>
          <span v-if="model.vip" class="video-gen-model-picker__vip">VIP</span>
          <span v-if="model.diamond" class="video-gen-model-picker__diamond">◆</span>
          <span v-if="model.promoTag" class="video-gen-model-picker__promo">
            {{ model.promoTag }}
          </span>
        </span>
        <span v-if="model.description" class="video-gen-model-picker__desc">
          {{ model.description }}
        </span>
      </span>
      <span class="video-gen-model-picker__eta">{{ model.duration }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { VIDEO_GEN_MODELS, type VideoGenModelId } from './constants'

const props = defineProps<{
  modelId: VideoGenModelId
}>()

const emit = defineEmits<{
  'update:modelId': [value: VideoGenModelId]
  select: [value: VideoGenModelId]
}>()

function selectModel(id: VideoGenModelId) {
  if (props.modelId === id) return
  emit('update:modelId', id)
  emit('select', id)
}
</script>

<style scoped lang="scss">
.video-gen-model-picker {
  width: 320px;
  max-height: 360px;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  overflow-y: auto;
}

.video-gen-model-picker__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #111827;
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    background: #f3f4f6;
  }
}

.video-gen-model-picker__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;

  &[data-icon='seedance'] {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);

    &::after {
      content: '▮';
      font-size: 10px;
      letter-spacing: -2px;
    }
  }

  &[data-icon='happy-horse'] {
    background: linear-gradient(135deg, #f59e0b, #f97316);

    &::after {
      content: '马';
      font-size: 11px;
    }
  }

  &[data-icon='kling'] {
    background: linear-gradient(135deg, #14b8a6, #0d9488);
    border-radius: 50%;

    &::after {
      content: 'K';
      font-size: 11px;
    }
  }

  &[data-icon='wan'] {
    background: linear-gradient(135deg, #a855f7, #7c3aed);

    &::after {
      content: 'W';
      font-size: 11px;
    }
  }
}

.video-gen-model-picker__body {
  flex: 1;
  min-width: 0;
}

.video-gen-model-picker__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.video-gen-model-picker__name {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}

.video-gen-model-picker__vip {
  padding: 1px 5px;
  border-radius: 4px;
  background: linear-gradient(135deg, #c4b5fd, #a78bfa);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
}

.video-gen-model-picker__diamond {
  color: #f59e0b;
  font-size: 10px;
  line-height: 1;
}

.video-gen-model-picker__promo {
  padding: 1px 6px;
  border-radius: 999px;
  background: #fef3c7;
  color: #b45309;
  font-size: 10px;
  line-height: 1.4;
  white-space: nowrap;
}

.video-gen-model-picker__desc {
  display: block;
  margin-top: 4px;
  color: #9ca3af;
  font-size: 11px;
  line-height: 1.4;
}

.video-gen-model-picker__eta {
  flex-shrink: 0;
  margin-top: 2px;
  color: #9ca3af;
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
}
</style>
