<template>
  <div class="video-dialogue-footer">
    <div class="video-dialogue-footer__left">
      <div class="video-dialogue-footer__model-wrap">
        <button
          type="button"
          class="video-dialogue-footer__model"
          :class="{ 'video-dialogue-footer__model--active': showModelMenu }"
          @mousedown.stop
          @click.stop="toggleModelMenu"
        >
          <span class="video-dialogue-footer__model-icon" aria-hidden="true" />
          {{ selectedModelName }}
          <span class="video-dialogue-footer__model-caret" aria-hidden="true" />
        </button>
        <div
          v-if="showModelMenu"
          class="video-dialogue-footer__model-menu"
          @mousedown.stop
        >
          <button
            v-for="model in modelMenu"
            :key="model.key"
            type="button"
            class="video-dialogue-footer__model-item"
            :class="{ 'video-dialogue-footer__model-item--active': model.key === selectedModelKey }"
            @click="selectModel(model)"
          >
            <span
              class="video-dialogue-footer__model-item-icon"
              :class="{ 'video-dialogue-footer__model-item-icon--font': isDialogueModelIconfont(model.icon) }"
              :data-icon="isDialogueModelIconfont(model.icon) ? undefined : model.icon"
              aria-hidden="true"
            >
              <i
                v-if="isDialogueModelIconfont(model.icon)"
                class="iconfont"
                :class="normalizeDialogueModelIcon(model.icon)"
              />
            </span>
            <span class="video-dialogue-footer__model-item-name">{{ model.name }}</span>
          </button>
        </div>
      </div>
      <!-- <div class="video-dialogue-footer__tools">
        <button type="button" class="video-dialogue-footer__tool" title="图片">
          <span class="video-dialogue-footer__tool-icon" data-icon="image" aria-hidden="true" />
        </button>
        <button type="button" class="video-dialogue-footer__tool" title="选择">
          <span class="video-dialogue-footer__tool-icon" data-icon="cursor" aria-hidden="true" />
        </button>
      </div> -->
    </div>
    <div class="video-dialogue-footer__actions">
      <!-- <button type="button" class="video-dialogue-footer__auto">
        全能参考
        <span class="video-dialogue-footer__select-arrow" aria-hidden="true" />
      </button> -->
      <div class="video-dialogue-footer__gen-settings-wrap">
        <button
          type="button"
          class="video-dialogue-footer__auto"
          :class="{ 'video-dialogue-footer__auto--active': showVideoSettings }"
          @mousedown.stop
          @click.stop="toggleVideoSettings"
        >
        <i class="iconfont icon-ic_suodingkuangaobi" style="font-size: 16px;"></i>
          {{ videoSettingsLabel }}
          <span class="video-dialogue-footer__select-arrow" aria-hidden="true" />
        </button>
        <div
          v-if="showVideoSettings"
          class="video-dialogue-footer__gen-settings-menu"
          @mousedown.stop
        >
          <VideoGenSettingsPopover
            v-model:duration="videoDuration"
            v-model:aspect-ratio="videoAspectRatio"
            v-model:resolution="videoResolution"
            v-model:generate-audio="generateAudio"
            :model-key="selectedModelKey"
            :mode="submitMode"
            :chat-tools="chatTools"
            @close="showVideoSettings = false"
          />
        </div>
      </div>
      <button
        type="button"
        class="video-dialogue__tool"
        :class="{ 'video-dialogue__tool--loading': translating }"
        :title="translating ? '翻译中' : '翻译'"
        :disabled="translating"
        @mousedown.stop
        @click.stop="onTranslatePrompt"
      >
        <span v-if="translating" class="video-dialogue__translate-label">翻译中...</span>
        <i v-else class="iconfont icon-fanyi" style="font-size: 16px;color: #000000;"></i>
        <!-- <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
          aria-hidden="true"
          role="img"
          class="iconify iconify--libtv pointer-events-none text-fg-default size-4"
          width="1.1em"
          height="1em"
          viewBox="0 0 19.71 18"
        ><path d="M15.52 7.2c.16 0 .31.1.37.26l3.8 10a.4.4 0 0 1-.38.54h-1.03a.4.4 0 0 1-.37-.27l-.88-2.48h-4.36l-.88 2.48a.4.4 0 0 1-.37.27h-1.03a.4.4 0 0 1-.37-.54l3.79-10a.4.4 0 0 1 .37-.26zM7.7 0c.22 0 .4.18.4.4v1.4H14c.22 0 .4.18.4.4v1a.4.4 0 0 1-.4.4h-2.21a16 16 0 0 1-1.42 3.33A11 11 0 0 1 8.5 9.54l1.99 2.02c.1.11.14.28.09.42l-.43 1.16a.3.3 0 0 1-.5.1l-2.4-2.46-4.27 4.24a.4.4 0 0 1-.56 0l-.7-.7a.4.4 0 0 1 0-.56L6 9.5q-.79-.8-1.43-1.8-.55-.85-1-1.89a.3.3 0 0 1 .27-.41h1.2a.4.4 0 0 1 .35.22q.39.74.79 1.31.45.65 1.08 1.3.73-.73 1.54-2.08.8-1.33 1.2-2.55H.4a.4.4 0 0 1-.4-.4v-1c0-.22.18-.4.4-.4h5.9V.4c0-.22.18-.4.4-.4zm5.53 13.68h3.24l-1.62-4.59z" fill="currentColor"></path></svg> -->
      </button>
      <span class="video-dialogue-footer__credits">
        <i class="iconfont icon-huiyuanjifen" style="font-size: 14px;color: rgb(255, 198, 0);"></i>
        &nbsp;{{ estimatedCreditsLabel }}
      </span>
      <a-popover placement="top">
        <template #content>
          <span>发送</span>
        </template>
        <button
          type="button"
          class="video-dialogue-footer__send"
          :class="{ 'video-dialogue-footer__send--disabled': disabled }"
          :disabled="disabled"
          @mousedown.stop
          @click.stop="onSend"
        >
          <span class="video-dialogue-footer__send-icon" aria-hidden="true" />
        </button>
      </a-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import VideoGenSettingsPopover from './VideoGenSettingsPopover.vue'
import { useVideoGenPointEstimate } from './composables/useVideoGenPointEstimate'
import {
  VIDEO_DIALOGUE_MODEL_MENU,
  VIDEO_GEN_DURATIONS,
  buildVideoDialogueModelsFromCapabilities,
  formatVideoGenSettings,
  isDialogueModelIconfont,
  normalizeDialogueModelIcon,
  normalizeVideoDialogueSettingsForModel,
  resolveVideoDialogueModelApiValue,
  type ChatTools,
  type VideoDialogueModelItem,
  type VideoDialogueSettings,
  type VideoDialogueSubmitPayload,
  type VideoGenAspectRatio,
  type VideoGenDuration,
  type VideoGenResolution,
} from './constants'

export type VideoDialogueFooterParams = Omit<VideoDialogueSubmitPayload, 'prompt'>

const props = defineProps<{
  chatTools?: ChatTools | null
  disabled?: boolean
  translating?: boolean
  /** 文本节点文生视频固定 text-to-video；视频对话保持 reference */
  defaultMode?: VideoDialogueSubmitPayload['mode']
}>()

const emit = defineEmits<{
  submit: [payload: VideoDialogueFooterParams]
  translate: []
}>()

const showVideoSettings = ref(false)
const showModelMenu = ref(false)
const videoDuration = ref<VideoGenDuration>(VIDEO_GEN_DURATIONS[0])
const videoAspectRatio = ref<VideoGenAspectRatio>('16:9')
const videoResolution = ref<VideoGenResolution>('480P')
const generateAudio = ref(true)
const selectedModelKey = ref(VIDEO_DIALOGUE_MODEL_MENU[0].key)
const submitMode = computed(() => props.defaultMode ?? 'reference')
const { estimatedCreditsLabel } = useVideoGenPointEstimate({
  modelKey: () => selectedModelKey.value,
  ratio: () => videoAspectRatio.value,
  resolution: () => videoResolution.value,
  duration: () => videoDuration.value,
  generateAudio: () => generateAudio.value,
  videoCount: () => 1,
  mode: () => submitMode.value,
  chatTools: () => props.chatTools,
})

const modelMenu = computed(() =>
  buildVideoDialogueModelsFromCapabilities(props.chatTools),
)
const selectedModelName = computed(
  () =>
    modelMenu.value.find((model) => model.key === selectedModelKey.value)?.name ??
    modelMenu.value[0]?.name ??
    VIDEO_DIALOGUE_MODEL_MENU[0].name,
)

function applyNormalizedToolbarSettings(
  partial: Partial<VideoDialogueSettings> = {},
) {
  const normalized = normalizeVideoDialogueSettingsForModel(
    {
      modelKey: selectedModelKey.value,
      aspectRatio: videoAspectRatio.value,
      resolution: videoResolution.value,
      duration: videoDuration.value,
      generateAudio: generateAudio.value,
      videoCount: 1,
      mode: props.defaultMode ?? 'text-to-video',
      ...partial,
    },
    props.chatTools,
  )
  selectedModelKey.value = normalized.modelKey
  videoAspectRatio.value = normalized.aspectRatio
  videoResolution.value = normalized.resolution
  videoDuration.value = normalized.duration
  generateAudio.value = normalized.generateAudio
}

function syncDialogueDefaultsFromChatTools() {
  applyNormalizedToolbarSettings()
}

watch(
  () => props.chatTools,
  () => {
    syncDialogueDefaultsFromChatTools()
  },
  { immediate: true, deep: true },
)

watch(
  () => selectedModelKey.value,
  () => {
    applyNormalizedToolbarSettings()
  },
)

const videoSettingsLabel = computed(() =>
  formatVideoGenSettings(videoDuration.value, videoAspectRatio.value, videoResolution.value),
)

function toggleVideoSettings() {
  showVideoSettings.value = !showVideoSettings.value
  if (showVideoSettings.value) {
    showModelMenu.value = false
  }
}

function toggleModelMenu() {
  showModelMenu.value = !showModelMenu.value
  if (showModelMenu.value) {
    showVideoSettings.value = false
  }
}

function selectModel(model: VideoDialogueModelItem) {
  selectedModelKey.value = model.key
  showModelMenu.value = false
}

function onTranslatePrompt() {
  emit('translate')
}

function onSend() {
  if (props.disabled) return
  emit('submit', {
    model: resolveVideoDialogueModelApiValue(selectedModelKey.value, props.chatTools),
    ratio: videoAspectRatio.value,
    clarity: videoResolution.value,
    duration: videoDuration.value,
    generateAudio: generateAudio.value,
    videoCount: 1,
    mode: submitMode.value,
  })
}

function onDocMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (showModelMenu.value && !target?.closest('.video-dialogue-footer__model-wrap')) {
    showModelMenu.value = false
  }
  if (showVideoSettings.value && !target?.closest('.video-dialogue-footer__gen-settings-wrap')) {
    showVideoSettings.value = false
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
.video-dialogue-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.video-dialogue-footer__left {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.video-dialogue-footer__model-wrap,
.video-dialogue-footer__gen-settings-wrap {
  position: relative;
  flex-shrink: 0;
}

.video-dialogue-footer__model {
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

.video-dialogue-footer__model--active {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.video-dialogue-footer__model-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath fill='%237c8cff' d='M7 1.5 8.3 5 11.8 6.3 8.3 7.6 7 11.1 5.7 7.6 2.2 6.3 5.7 5z'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}

.video-dialogue-footer__model-caret {
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 6.25 5 3.75 7.5 6.25'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.video-dialogue-footer__model-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 6;
  min-width: 240px;
  max-width: 320px;
  max-height: 280px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid #ebedf0;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
}

.video-dialogue-footer__model-item {
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

.video-dialogue-footer__model-item--active {
  background: #f3f4f6;
}

.video-dialogue-footer__model-item-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background-color: #f3f4f6;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 18px 18px;

  &[data-icon='lib'],
  &[data-icon='seedream'],
  &[data-icon='seedance'],
  &[data-icon='kling'],
  &[data-icon='happy-horse'],
  &[data-icon='wan'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='M4 13V8M9 13V5M14 13v-3'/%3E%3C/svg%3E");
  }

  &[data-icon='lib'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Ccircle cx='9' cy='9' r='6' stroke='%236b7280' stroke-width='1.3'/%3E%3Ccircle cx='9' cy='9' r='2.2' stroke='%236b7280' stroke-width='1.3'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-width='1.3' d='M9 3v1.6M9 13.4V15M3 9h1.6M13.4 9H15'/%3E%3C/svg%3E");
  }

  &--font {
    display: flex;
    align-items: center;
    justify-content: center;
    background-image: none;

    .iconfont {
      font-size: 18px;
      line-height: 1;
      color: #6b7280;
    }
  }
}

.video-dialogue-footer__model-item-name {
  flex: 1;
  min-width: 0;
  color: #374151;
  font-size: 13px;
  line-height: 1.3;
  word-break: break-all;
}

.video-dialogue-footer__tools,
.video-dialogue-footer__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.video-dialogue-footer__tool {
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

  &:hover {
    background: #f3f4f6;
  }
}

.video-dialogue-footer__tool-icon {
  width: 16px;
  height: 16px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 16px 16px;

  &[data-icon='image'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Crect x='2.5' y='3.5' width='11' height='9' rx='1' stroke='%236b7280' stroke-width='1.2'/%3E%3Ccircle cx='6' cy='7' r='1.2' fill='%236b7280'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-width='1.2' d='m4 11 2.5-2.5 2 2 2.5-3 2 3.5'/%3E%3C/svg%3E");
  }

  &[data-icon='cursor'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath fill='%236b7280' d='M4 2.5 12.5 8 8.5 8.8 10.5 13.5 8.8 14.2 6.8 9.5 4 11.5z'/%3E%3C/svg%3E");
  }
}

.video-dialogue-footer__auto {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
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

.video-dialogue-footer__auto--active {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.video-dialogue-footer__select-arrow {
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 3.75 5 6.25 7.5 3.75'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.video-dialogue-footer__gen-settings-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 5;
}

.video-dialogue__tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #f3f4f6;
    color: #374151;
  }

  &:disabled,
  &--loading {
    opacity: 0.55;
    cursor: not-allowed;
    width: auto;
    min-width: 28px;
    padding: 0 6px;
  }
}

.video-dialogue__translate-label {
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  color: #6b7280;
}

.video-dialogue-footer__credits {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.video-dialogue-footer__credits-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%23f59e0b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M7.5 1.5 8.8 5.2l3.9.3-3 2.3 1.1 3.8L7.5 9.6 3.2 11.6l1.1-3.8-3-2.3 3.9-.3z'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}

.video-dialogue-footer__send {
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

.video-dialogue-footer__send-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.4' d='M7 10V4M4.5 6.5 7 4l2.5 2.5'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}
</style>
