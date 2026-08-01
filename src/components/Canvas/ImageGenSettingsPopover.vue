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
          v-for="ratio in aspectRatioOptions"
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
      <div class="image-gen-settings__counts">
        <button
          v-for="item in resolutionOptions"
          :key="item"
          type="button"
          class="image-gen-settings__count"
          :class="{ 'image-gen-settings__count--active': resolution === item }"
          @click="resolution = item"
        >
          {{ item }}
        </button>
      </div>
    </section>

    <div class="image-gen-settings__divider" aria-hidden="true" />

    <section class="image-gen-settings__section">
      <p class="image-gen-settings__title">{{ IMAGE_GEN_COUNT_LABEL }}</p>
      <div class="image-gen-settings__counts">
        <button
          v-for="count in imageCountOptions"
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

    <div class="image-gen-settings__actions">
      <button type="button" class="image-gen-settings__confirm" @click="emit('close')">
        确认
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  IMAGE_GEN_ASPECT_RATIO_LABEL,
  IMAGE_DESIGN_IPS_TITLE,
  IMAGE_GEN_ASPECT_RATIOS,
  IMAGE_GEN_COUNT_LABEL,
  buildImageDialogueAspectRatiosFromCapabilities,
  buildImageDialogueResolutionsFromCapabilities,
  buildImageDialogueCountOptionsFromCapabilities,
  type ChatTools,
  type ImageDialogueAspectRatioOption,
} from './constants'

const props = withDefaults(
  defineProps<{
    aspectRatio?: string
    resolution?: string
    imageCount?: number
    chatTools?: ChatTools | null
    modelKey?: string
    aspectRatios?: ImageDialogueAspectRatioOption[]
    resolutions?: string[]
    imageCounts?: number[]
  }>(),
  {
    aspectRatio: 'auto',
    resolution: '2K',
    imageCount: 1,
    chatTools: null,
    modelKey: '',
  },
)

const emit = defineEmits<{
  'update:aspectRatio': [value: string]
  'update:resolution': [value: string]
  'update:imageCount': [value: number]
  close: []
}>()

const aspectRatioOptions = computed(() => {
  if (props.aspectRatios?.length) return props.aspectRatios
  const fromApi = buildImageDialogueAspectRatiosFromCapabilities(
    props.chatTools,
    props.modelKey || undefined,
  )
  if (fromApi.length) return fromApi
  return IMAGE_GEN_ASPECT_RATIOS.map((item) => ({
    key: item.key,
    label: item.label,
    preview: item.preview,
  }))
})

const resolutionOptions = computed(() => {
  if (props.resolutions?.length) return props.resolutions
  return buildImageDialogueResolutionsFromCapabilities(
    props.chatTools,
    props.modelKey || undefined,
  )
})

const imageCountOptions = computed(() => {
  if (props.imageCounts?.length) return props.imageCounts
  return buildImageDialogueCountOptionsFromCapabilities(
    props.chatTools,
    props.modelKey || undefined,
  )
})

const aspectRatio = computed({
  get: () => props.aspectRatio,
  set: (value: string) => emit('update:aspectRatio', value),
})

const resolution = computed({
  get: () => props.resolution,
  set: (value: string) => emit('update:resolution', value),
})

const imageCount = computed({
  get: () => props.imageCount,
  set: (value: number) => emit('update:imageCount', value),
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

.image-gen-settings__actions {
  margin-top: 14px;
}

.image-gen-settings__confirm {
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: 10px;
  background: #111827;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #1f2937;
  }
}
</style>
