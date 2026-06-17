<template>
  <div class="image-gen-settings">
    <button
      type="button"
      class="image-gen-settings__close"
      title="关闭"
      @click="emit('close')"
    >
      <span class="image-gen-settings__close-icon" aria-hidden="true" />
    </button>
    <section class="image-gen-settings__section">
      <p class="image-gen-settings__title">{{ IMAGE_GEN_ASPECT_RATIO_LABEL }}</p>
      <div class="image-gen-settings__ratio-grid">
        <button
          v-for="ratio in IMAGE_GEN_ASPECT_RATIOS"
          :key="ratio.key"
          type="button"
          class="image-gen-settings__ratio"
          :class="{ 'image-gen-settings__ratio--active': aspectRatio === ratio.key }"
          @click="aspectRatio = ratio.key"
        >
          <span
            class="image-gen-settings__ratio-preview"
            :style="{
              width: `${ratio.preview.width}px`,
              height: `${ratio.preview.height}px`,
            }"
            aria-hidden="true"
          />
          <span class="image-gen-settings__ratio-label">{{ ratio.label }}</span>
        </button>
      </div>
    </section>

    <div class="image-gen-settings__divider" aria-hidden="true" />
    <section class="image-gen-settings__section">
      <p class="image-gen-settings__title">{{ IMAGE_DESIGN_IPS_TITLE }}</p>
      <div class="image-gen-settings__ratio-grid">
        <!-- <button
          v-for="ratio in IMAGE_DESIGN_IPS_MENU"
          :key="ratio.key"
          type="button"
          class="image-gen-settings__ratio"
          :class="{ 'image-gen-settings__ratio--active': aspectRatio === ratio.key }"
          @click="aspectRatio = ratio.key"
        >
          <span
            class="image-gen-settings__ratio-preview"
            :style="{
              width: `${ratio.preview.width}px`,
              height: `${ratio.preview.height}px`,
            }"
            aria-hidden="true"
          />
          <span class="image-gen-settings__ratio-label">{{ ratio.label }}</span>
        </button> -->
      </div>
    </section>

    <div class="image-gen-settings__divider" aria-hidden="true" />

    <section class="image-gen-settings__section">
      <p class="image-gen-settings__title">{{ IMAGE_GEN_COUNT_LABEL }}</p>
      <div class="image-gen-settings__counts">
        <button
          v-for="count in IMAGE_GEN_COUNTS"
          :key="count"
          type="button"
          class="image-gen-settings__count"
          :class="{ 'image-gen-settings__count--active': imageCount === count }"
          @click="imageCount = count"
        >
          x{{ count }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  IMAGE_GEN_ASPECT_RATIO_LABEL,
  IMAGE_DESIGN_IPS_TITLE,
  IMAGE_GEN_ASPECT_RATIOS,
  IMAGE_GEN_COUNT_LABEL,
  IMAGE_GEN_COUNTS,
  type ImageGenAspectRatio,
  type ImageGenCount,
} from './constants'

const props = withDefaults(
  defineProps<{
    aspectRatio?: ImageGenAspectRatio
    imageCount?: ImageGenCount
  }>(),
  {
    aspectRatio: 'auto',
    imageCount: 1,
  },
)

const emit = defineEmits<{
  'update:aspectRatio': [value: ImageGenAspectRatio]
  'update:imageCount': [value: ImageGenCount]
  close: []
}>()

const aspectRatio = computed({
  get: () => props.aspectRatio,
  set: (value: ImageGenAspectRatio) => emit('update:aspectRatio', value),
})

const imageCount = computed({
  get: () => props.imageCount,
  set: (value: ImageGenCount) => emit('update:imageCount', value),
})
</script>

<style scoped lang="scss">
.image-gen-settings {
  position: relative;
  width: 248px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.image-gen-settings__close {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.image-gen-settings__close-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='m3.5 3.5 7 7m0-7-7 7'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}

.image-gen-settings__section + .image-gen-settings__section {
  margin-top: 0;
}

.image-gen-settings__title {
  margin: 0 0 10px;
  color: #374151;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.image-gen-settings__ratio-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.image-gen-settings__ratio {
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
    border-color: #60a5fa;
    background: #eff6ff;
    color: #2563eb;
  }
}

.image-gen-settings__ratio-preview {
  display: block;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  opacity: 0.85;
}

.image-gen-settings__ratio-label {
  font-size: 11px;
  line-height: 1;
}

.image-gen-settings__divider {
  height: 1px;
  margin: 12px 0;
  background: #f3f4f6;
}

.image-gen-settings__counts {
  display: flex;
  gap: 8px;
}

.image-gen-settings__count {
  min-width: 44px;
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

  &--active {
    border-color: #111827;
    background: #fff;
    color: #111827;
  }
}
</style>
