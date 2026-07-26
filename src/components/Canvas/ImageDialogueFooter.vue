<template>
  <div class="image-dialogue-footer image-dialogue-footer--light">
    <div class="image-dialogue-footer__left">
      <div class="image-dialogue-footer__model-wrap">
        <button
          type="button"
          class="image-dialogue-footer__model"
          :class="{ 'image-dialogue-footer__model--active': showModelMenu }"
          @mousedown.stop
          @click.stop="toggleModelMenu"
        >
          <span class="image-dialogue-footer__model-icon" aria-hidden="true" />
          {{ selectedModelName }}
          <span class="image-dialogue-footer__model-caret" aria-hidden="true" />
        </button>
        <div
          v-if="showModelMenu"
          class="image-dialogue-footer__model-menu"
          @mousedown.stop
        >
          <button
            v-for="model in modelMenu"
            :key="model.key"
            type="button"
            class="image-dialogue-footer__model-item"
            :class="{ 'image-dialogue-footer__model-item--active': model.key === selectedModelKey }"
            @click="selectModel(model)"
          >
            <span
              class="image-dialogue-footer__model-item-icon"
              :data-icon="model.icon"
              aria-hidden="true"
            />
            <span class="image-dialogue-footer__model-item-main">
              <span class="image-dialogue-footer__model-item-name">
                {{ model.name }}
                <span v-if="model.badge" class="image-dialogue-footer__model-item-badge">{{ model.badge }}</span>
              </span>
              <span v-if="model.desc" class="image-dialogue-footer__model-item-desc">{{ model.desc }}</span>
            </span>
            <span class="image-dialogue-footer__model-item-duration">{{ model.duration }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="image-dialogue-footer__right">
      <div class="image-dialogue-footer__gen-settings-wrap">
        <button
          type="button"
          class="image-dialogue-footer__pill"
          :class="{ 'image-dialogue-footer__pill--active': showGenSettings }"
          @mousedown.stop
          @click.stop="toggleGenSettings"
        >
          <span class="image-dialogue-footer__pill-icon" data-icon="frame" aria-hidden="true" />
          {{ qualityLabel }}
          <span class="image-dialogue-footer__select-arrow" aria-hidden="true" />
        </button>
        <div
          v-if="showGenSettings"
          class="image-dialogue-footer__gen-settings-menu"
          @mousedown.stop
        >
          <ImageGenSettingsPopover
            v-model:aspect-ratio="genAspectRatio"
            v-model:resolution="genResolution"
            v-model:image-count="genImageCount"
            :chat-tools="chatTools"
            @close="showGenSettings = false"
          />
        </div>
      </div>

      <button type="button" class="image-dialogue-footer__icon" title="标记">
        <span class="image-dialogue-footer__chip-icon" data-icon="mark" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="image-dialogue-footer__icon"
        :class="{ 'image-dialogue-footer__icon--loading': translating }"
        title="翻译"
        :disabled="translating"
        @mousedown.stop
        @click.stop="emit('translate')"
      >
        <span class="image-dialogue-footer__icon-glyph" data-icon="translate" aria-hidden="true" />
      </button>
      <span class="image-dialogue-footer__credits">
        <span class="image-dialogue-footer__credits-icon" aria-hidden="true" />
        {{ IMAGE_DIALOGUE_CREDITS }}
      </span>
      <button
        type="button"
        class="image-dialogue-footer__send"
        :class="{ 'image-dialogue-footer__send--disabled': disabled }"
        :disabled="disabled"
        title="发送"
        @mousedown.stop
        @click.stop="onSend"
      >
        <span class="image-dialogue-footer__send-icon" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ImageGenSettingsPopover from './ImageGenSettingsPopover.vue'
import {
  IMAGE_DIALOGUE_CREDITS,
  IMAGE_DIALOGUE_MODEL_MENU,
  buildImageDialogueAspectRatiosFromCapabilities,
  buildImageDialogueCountOptionsFromCapabilities,
  buildImageDialogueModelsFromCapabilities,
  buildImageDialogueResolutionsFromCapabilities,
  findImageDialogueSource,
  resolveImageDialogueModelKey,
  type ChatTools,
  type ImageDialogueModelItem,
  type ImageDialogueSubmitPayload,
} from './constants'

export type ImageDialogueFooterParams = Omit<
  ImageDialogueSubmitPayload,
  'prompt' | 'workflowId' | 'workflow'
>

const props = defineProps<{
  chatTools?: ChatTools | null
  disabled?: boolean
  translating?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: ImageDialogueFooterParams]
  translate: []
}>()

const showGenSettings = ref(false)
const showModelMenu = ref(false)
const genAspectRatio = ref('auto')
const genResolution = ref('2K')
const genImageCount = ref(1)
const selectedModelKey = ref(
  resolveImageDialogueModelKey(IMAGE_DIALOGUE_MODEL_MENU[0].key, null),
)

const modelMenu = computed(() =>
  buildImageDialogueModelsFromCapabilities(props.chatTools),
)
const countOptions = computed(() =>
  buildImageDialogueCountOptionsFromCapabilities(props.chatTools),
)
const aspectRatioOptions = computed(() =>
  buildImageDialogueAspectRatiosFromCapabilities(props.chatTools),
)
const resolutionOptions = computed(() =>
  buildImageDialogueResolutionsFromCapabilities(props.chatTools),
)

const selectedModelName = computed(
  () =>
    modelMenu.value.find((model) => model.key === selectedModelKey.value)?.name ??
    modelMenu.value[0]?.name ??
    IMAGE_DIALOGUE_MODEL_MENU[0].name,
)

const qualityLabel = computed(() => {
  const aspectLabel = genAspectRatio.value === 'auto' ? '自适应' : genAspectRatio.value
  return `${aspectLabel} · 标准画质 · ${genResolution.value}`
})

function syncDialogueDefaultsFromChatTools() {
  const models = modelMenu.value
  if (models.length) {
    const nextKey = resolveImageDialogueModelKey(selectedModelKey.value, props.chatTools)
    if (nextKey !== selectedModelKey.value) {
      selectedModelKey.value = nextKey
    }
  }

  const ratios = aspectRatioOptions.value
  if (ratios.length && !ratios.some((ratio) => ratio.key === genAspectRatio.value)) {
    genAspectRatio.value = ratios[0].key
  }

  const resolutions = resolutionOptions.value
  if (resolutions.length && !resolutions.includes(genResolution.value)) {
    genResolution.value = resolutions[0]
  }

  const counts = countOptions.value
  if (counts.length && !counts.includes(genImageCount.value)) {
    genImageCount.value = counts[0]
  }

  const capability = findImageDialogueSource(props.chatTools)
  const countParam = capability?.parameters?.count
  if (countParam && typeof countParam === 'object' && !Array.isArray(countParam)) {
    const defaultCount = Number((countParam as { default?: number }).default)
    if (Number.isFinite(defaultCount) && counts.includes(defaultCount)) {
      genImageCount.value = defaultCount
    }
  }
}

watch(
  () => props.chatTools,
  () => {
    syncDialogueDefaultsFromChatTools()
  },
  { immediate: true, deep: true },
)

function toggleGenSettings() {
  showGenSettings.value = !showGenSettings.value
  if (showGenSettings.value) {
    showModelMenu.value = false
  }
}

function toggleModelMenu() {
  showModelMenu.value = !showModelMenu.value
  if (showModelMenu.value) {
    showGenSettings.value = false
  }
}

function selectModel(model: ImageDialogueModelItem) {
  selectedModelKey.value = model.key
  showModelMenu.value = false
}

function onSend() {
  if (props.disabled) return
  emit('submit', {
    model: selectedModelKey.value,
    aspectRatio: genAspectRatio.value,
    count: genImageCount.value,
    resolution: genResolution.value,
  })
}

function onDocMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (showModelMenu.value && !target?.closest('.image-dialogue-footer__model-wrap')) {
    showModelMenu.value = false
  }
  if (showGenSettings.value && !target?.closest('.image-dialogue-footer__gen-settings-wrap')) {
    showGenSettings.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMouseDown, true)
})
</script>

<style scoped lang="scss">
.image-dialogue-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}

.image-dialogue-footer__left {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.image-dialogue-footer__right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.image-dialogue-footer__gen-settings-wrap,
.image-dialogue-footer__model-wrap {
  position: relative;
}

.image-dialogue-footer__gen-settings-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 5;
}

.image-dialogue-footer__select-arrow {
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 3.75 5 6.25 7.5 3.75'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.image-dialogue-footer__model {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid #ebedf0;
  border-radius: 999px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);

  &:hover {
    background: #f9fafb;
  }
}

.image-dialogue-footer__model-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath fill='%237c8cff' d='M7 1.5 8.3 5 11.8 6.3 8.3 7.6 7 11.1 5.7 7.6 2.2 6.3 5.7 5z'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}

.image-dialogue-footer__model-caret {
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 6.25 5 3.75 7.5 6.25'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.image-dialogue-footer__model--active {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.image-dialogue-footer__model-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 6;
  width: 300px;
  max-height: 360px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid #ebedf0;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
}

.image-dialogue-footer__model-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f6f7f9;
  }
}

.image-dialogue-footer__model-item--active {
  background: #f3f4f6;
}

.image-dialogue-footer__model-item-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background-color: #f3f4f6;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 18px 18px;

  &[data-icon='lib'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Ccircle cx='9' cy='9' r='6' stroke='%236b7280' stroke-width='1.3'/%3E%3Ccircle cx='9' cy='9' r='2.2' stroke='%236b7280' stroke-width='1.3'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-width='1.3' d='M9 3v1.6M9 13.4V15M3 9h1.6M13.4 9H15'/%3E%3C/svg%3E");
  }

  &[data-icon='navo'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.4' d='m4.5 4.5 9 9m0-9-9 9'/%3E%3C/svg%3E");
  }

  &[data-icon='seedream'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='M4 13V8M9 13V5M14 13v-3'/%3E%3C/svg%3E");
  }

  &[data-icon='mj'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='M9 3v9M9 12 4 11c.8 2 2.7 3 5 3s4.2-1 5-3zM9 5.5c1.6.4 3 1.8 3.4 3.5'/%3E%3C/svg%3E");
  }
}

.image-dialogue-footer__model-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.image-dialogue-footer__model-item-name {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #1f2937;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
}

.image-dialogue-footer__model-item-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 6px;
  background: #fde68a;
  color: #92400e;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}

.image-dialogue-footer__model-item-desc {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.3;
}

.image-dialogue-footer__model-item-duration {
  flex-shrink: 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1;
}

.image-dialogue-footer__pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid #ebedf0;
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

.image-dialogue-footer__pill--active {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.image-dialogue-footer__pill-icon {
  width: 14px;
  height: 14px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 14px 14px;

  &[data-icon='frame'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Crect x='2.5' y='2.5' width='9' height='9' rx='1.5' stroke='%236b7280' stroke-width='1.2'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-width='1.2' d='M2.5 5.5h9M5.5 2.5v9'/%3E%3C/svg%3E");
  }
}

.image-dialogue-footer__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #f3f4f6;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &--loading .image-dialogue-footer__icon-glyph[data-icon='translate'] {
    opacity: 0.35;
  }
}

.image-dialogue-footer__chip-icon {
  width: 14px;
  height: 14px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 14px 14px;

  &[data-icon='mark'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M7 12.5s4-3.2 4-6.5a4 4 0 1 0-8 0c0 3.3 4 6.5 4 6.5Z'/%3E%3Ccircle cx='7' cy='6' r='1.5' stroke='%236b7280' stroke-width='1.2'/%3E%3C/svg%3E");
  }
}

.image-dialogue-footer__icon-glyph {
  width: 16px;
  height: 16px;

  &[data-icon='translate'] {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 4h5M5 2.5v1.5M6.5 4c-.4 2.6-2 4.6-4 5.5M3.5 6.5c.6 1.4 1.8 2.4 3.2 2.9'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='m8.2 13 2.4-6h.4l2.4 6M9 11h3.6'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
  }
}

.image-dialogue-footer__credits {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 4px;
  color: #6b7280;
  font-size: 12px;
  line-height: 1;
}

.image-dialogue-footer__credits-icon {
  width: 13px;
  height: 13px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' fill='none' viewBox='0 0 13 13'%3E%3Cpath fill='%23f5a623' d='M7.2 1 3 7.3h2.6L5.2 12 9.8 5.4H7z'/%3E%3C/svg%3E") center / 13px 13px no-repeat;
}

.image-dialogue-footer__send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #111827;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #1f2937;
  }

  &--disabled,
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.image-dialogue-footer__send-icon {
  width: 16px;
  height: 16px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.4' d='M7 10V4M4.5 6.5 7 4l2.5 2.5'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}
</style>
