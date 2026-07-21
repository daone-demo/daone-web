<template>
  <div class="video-dialogue">
    <div class="video-dialogue__head">
      <div class="video-dialogue__greeting">
        <span class="video-dialogue__avatar" aria-hidden="true" />
        <span class="video-dialogue__greeting-text">{{ VIDEO_DIALOGUE_GREETING }}</span>
      </div>
      <div class="video-dialogue__head-actions">
        <button type="button" class="video-dialogue__select">AI脚本</button>
        <div class="video-dialogue__advisor-wrap">
          <button
            type="button"
            class="video-dialogue__select"
            :class="{ 'video-dialogue__select--active': showAdvisorMenu }"
            @click="toggleAdvisorMenu"
          >
            视频参谋
            <span class="video-dialogue__select-arrow" aria-hidden="true" />
          </button>
          <div
            v-if="showAdvisorMenu"
            class="video-dialogue__advisor-menu"
            @mousedown.stop
          >
            <div
              v-for="item in VIDEO_ADVISOR_MENU"
              :key="item.key"
              class="video-dialogue__advisor-item"
              :class="{ 'video-dialogue__advisor-item--active': activeAdvisorKey === item.key }"
              @mouseenter="activeAdvisorKey = item.key"
            >
              <span>{{ item.label }}</span>
              <span class="video-dialogue__advisor-arrow" aria-hidden="true" />
              <div
                v-if="activeAdvisorKey === item.key"
                class="video-dialogue__advisor-submenu"
              >
                <button
                  v-for="child in item.children"
                  :key="child.key"
                  type="button"
                  class="video-dialogue__advisor-subitem"
                  @click="selectAdvisorItem"
                >
                  {{ child.label }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="video-dialogue__select"
          :class="{ 'video-dialogue__select--active': showStoryboardPanel }"
          @click="toggleStoryboardPanel"
        >
          分镜板图
        </button>
        <button type="button" class="video-dialogue__history" title="历史">
          <span class="video-dialogue__history-icon" aria-hidden="true" />
        </button>
      </div>
    </div>

    <textarea
      :value="modelValue"
      class="video-dialogue__input"
      :placeholder="VIDEO_DIALOGUE_PLACEHOLDER"
      rows="3"
      @input="onInput"
    />

    <div class="video-dialogue__footer">
      <div class="video-dialogue__footer-left">
        <div class="video-dialogue__model-wrap">
          <button
            type="button"
            class="video-dialogue__model"
            :class="{ 'video-dialogue__model--active': showModelMenu }"
            @click="toggleModelMenu"
          >
            <span class="video-dialogue__model-icon" aria-hidden="true" />
            {{ selectedModelName }}
            <span class="video-dialogue__model-caret" aria-hidden="true" />
          </button>
          <div
            v-if="showModelMenu"
            class="video-dialogue__model-menu"
            @mousedown.stop
          >
            <button
              v-for="model in modelMenu"
              :key="model.key"
              type="button"
              class="video-dialogue__model-item"
              :class="{ 'video-dialogue__model-item--active': model.key === selectedModelKey }"
              @click="selectModel(model)"
            >
              <span
                class="video-dialogue__model-item-icon"
                :data-icon="model.icon"
                aria-hidden="true"
              />
              <span class="video-dialogue__model-item-name">{{ model.name }}</span>
            </button>
          </div>
        </div>
        <div class="video-dialogue__tools">
        <button type="button" class="video-dialogue__tool" title="图片">
          <span class="video-dialogue__tool-icon" data-icon="image" aria-hidden="true" />
        </button>
        <button type="button" class="video-dialogue__tool" title="选择">
          <span class="video-dialogue__tool-icon" data-icon="cursor" aria-hidden="true" />
        </button>
        </div>
      </div>
      <div class="video-dialogue__actions">
        <button type="button" class="video-dialogue__auto">
          全能参考
          <span class="video-dialogue__select-arrow" aria-hidden="true" />
        </button>
        <div class="video-dialogue__gen-settings-wrap">
          <button
            type="button"
            class="video-dialogue__auto"
            :class="{ 'video-dialogue__auto--active': showVideoSettings }"
            @click="toggleVideoSettings"
          >
            {{ videoSettingsLabel }}
            <span class="video-dialogue__select-arrow" aria-hidden="true" />
          </button>
          <div
            v-if="showVideoSettings"
            class="video-dialogue__gen-settings-menu"
            @mousedown.stop
          >
            <VideoGenSettingsPopover
              v-model:duration="videoDuration"
              v-model:aspect-ratio="videoAspectRatio"
              v-model:resolution="videoResolution"
              v-model:generate-audio="generateAudio"
              :chat-tools="chatTools"
              @close="showVideoSettings = false"
            />
          </div>
        </div>
        <span class="video-dialogue__credits">
          <span class="video-dialogue__credits-icon" aria-hidden="true" />
          {{ VIDEO_DIALOGUE_CREDITS }}
        </span>
        <button type="button" class="video-dialogue__send" title="发送">
          <span class="video-dialogue__send-icon" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div
      v-if="showStoryboardPanel"
      class="video-dialogue__storyboard-wrap"
      @mousedown.stop
    >
      <VideoStoryboardPanel
        v-model:duration="storyboardDuration"
        v-model:description="storyboardDescription"
        v-model:ratio="storyboardRatio"
        @close="resetStoryboardPanel"
        @cancel="resetStoryboardPanel"
        @confirm="onStoryboardConfirm"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import VideoGenSettingsPopover from './VideoGenSettingsPopover.vue'
import VideoStoryboardPanel from './VideoStoryboardPanel.vue'
import {
  VIDEO_ADVISOR_MENU,
  VIDEO_DIALOGUE_CREDITS,
  VIDEO_DIALOGUE_GREETING,
  VIDEO_DIALOGUE_PLACEHOLDER,
  buildVideoDialogueAspectRatiosFromCapabilities,
  buildVideoDialogueClaritiesFromCapabilities,
  buildVideoDialogueDurationRangeFromCapabilities,
  buildVideoDialogueGenerateAudioOptions,
  buildVideoDialogueModelsFromCapabilities,
  formatVideoGenSettings,
  VIDEO_DIALOGUE_MODEL_MENU,
  type ChatTools,
  type VideoDialogueModelItem,
  type VideoGenAspectRatio,
  type VideoGenDuration,
  type VideoGenResolution,
  type VideoStoryboardDuration,
  type VideoStoryboardRatio,
} from './constants'

const props = defineProps<{
  modelValue: string
  chatTools?: ChatTools | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showAdvisorMenu = ref(false)
const showStoryboardPanel = ref(false)
const showVideoSettings = ref(false)
const showModelMenu = ref(false)
const activeAdvisorKey = ref<(typeof VIDEO_ADVISOR_MENU)[number]['key']>('dynamic')
const storyboardDuration = ref<VideoStoryboardDuration>(5)
const storyboardDescription = ref('')
const storyboardRatio = ref<VideoStoryboardRatio>('16:9')
const videoDuration = ref<VideoGenDuration>(5)
const videoAspectRatio = ref<VideoGenAspectRatio>('16:9')
const videoResolution = ref<VideoGenResolution>('720P')
const generateAudio = ref(true)
const selectedModelKey = ref(VIDEO_DIALOGUE_MODEL_MENU[0].key)

const modelMenu = computed(() =>
  buildVideoDialogueModelsFromCapabilities(props.chatTools),
)
const selectedModelName = computed(
  () =>
    modelMenu.value.find((model) => model.key === selectedModelKey.value)?.name ??
    modelMenu.value[0]?.name ??
    VIDEO_DIALOGUE_MODEL_MENU[0].name,
)

const aspectRatioOptions = computed(() =>
  buildVideoDialogueAspectRatiosFromCapabilities(props.chatTools),
)
const clarityOptions = computed(() =>
  buildVideoDialogueClaritiesFromCapabilities(props.chatTools),
)
const durationRange = computed(() =>
  buildVideoDialogueDurationRangeFromCapabilities(props.chatTools),
)
const generateAudioOptions = computed(() =>
  buildVideoDialogueGenerateAudioOptions(props.chatTools),
)

function syncDialogueDefaultsFromChatTools() {
  const models = modelMenu.value
  if (models.length && !models.some((model) => model.key === selectedModelKey.value)) {
    selectedModelKey.value = models[0].key
  }

  const ratios = aspectRatioOptions.value
  if (ratios.length && !ratios.some((ratio) => ratio.key === videoAspectRatio.value)) {
    videoAspectRatio.value = ratios[0].key as VideoGenAspectRatio
  }

  const clarities = clarityOptions.value
  if (clarities.length && !clarities.includes(videoResolution.value)) {
    videoResolution.value = clarities[0] as VideoGenResolution
  }

  const range = durationRange.value
  const currentDuration = videoDuration.value
  if (currentDuration < range.min || currentDuration > range.max) {
    videoDuration.value = (range.defaultValue ?? range.min) as VideoGenDuration
  }

  const audioOptions = generateAudioOptions.value
  if (audioOptions.length && !audioOptions.includes(generateAudio.value)) {
    generateAudio.value = audioOptions[0]
  }
}

watch(
  () => props.chatTools,
  () => {
    syncDialogueDefaultsFromChatTools()
  },
  { immediate: true, deep: true },
)

const videoSettingsLabel = computed(() =>
  formatVideoGenSettings(videoDuration.value, videoAspectRatio.value, videoResolution.value),
)

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

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
    showAdvisorMenu.value = false
    showStoryboardPanel.value = false
  }
}

function selectModel(model: VideoDialogueModelItem) {
  selectedModelKey.value = model.key
  showModelMenu.value = false
}

function toggleAdvisorMenu() {
  showAdvisorMenu.value = !showAdvisorMenu.value
  if (showAdvisorMenu.value) {
    activeAdvisorKey.value = 'dynamic'
    showStoryboardPanel.value = false
    showVideoSettings.value = false
    showModelMenu.value = false
  }
}

function toggleStoryboardPanel() {
  showStoryboardPanel.value = !showStoryboardPanel.value
  if (showStoryboardPanel.value) {
    showAdvisorMenu.value = false
    showVideoSettings.value = false
    showModelMenu.value = false
  }
}

function resetStoryboardPanel() {
  showStoryboardPanel.value = false
}

function onStoryboardConfirm() {
  resetStoryboardPanel()
}

function selectAdvisorItem() {
  showAdvisorMenu.value = false
}
</script>

<style scoped lang="scss">
.video-dialogue {
  position: relative;
  width: 100%;
  padding: 14px 16px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
  overflow: visible;
}

.video-dialogue__storyboard-wrap {
  position: absolute;
  top: 0;
  left: calc(100% + 12px);
  z-index: 4;
}

.video-dialogue__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.video-dialogue__greeting {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.video-dialogue__avatar {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f3f4f6 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='none' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='11' fill='%23eef2ff'/%3E%3Ccircle cx='12' cy='10' r='4' fill='%23c7d2fe'/%3E%3Cpath fill='%23c7d2fe' d='M6 18c1.2-2.4 3.4-3.8 6-3.8s4.8 1.4 6 3.8'/%3E%3C/svg%3E") center / 24px 24px no-repeat;
}

.video-dialogue__greeting-text {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-dialogue__head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.video-dialogue__advisor-wrap,
.video-dialogue__gen-settings-wrap {
  position: relative;
}

.video-dialogue__gen-settings-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 5;
}

.video-dialogue__auto--active {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.video-dialogue__select,
.video-dialogue__auto {
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

.video-dialogue__select--active {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.video-dialogue__select-arrow {
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 3.75 5 6.25 7.5 3.75'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.video-dialogue__advisor-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 3;
  min-width: 140px;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.video-dialogue__advisor-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  color: #374151;
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;

  &:hover,
  &--active {
    background: #f3f4f6;
  }
}

.video-dialogue__advisor-arrow {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M3.75 2.5 6.25 5 3.75 7.5'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.video-dialogue__advisor-submenu {
  position: absolute;
  top: 0;
  left: calc(100% + 6px);
  min-width: 140px;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.video-dialogue__advisor-subitem {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 13px;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.video-dialogue__history {
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

.video-dialogue__history-icon {
  width: 16px;
  height: 16px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M8 3.5v4.5l2.5 1.5'/%3E%3Ccircle cx='8' cy='8' r='5' stroke='%236b7280' stroke-width='1.2'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
}

.video-dialogue__input {
  width: 100%;
  min-height: 88px;
  padding: 12px 14px;
  border: 1px solid #eef0f3;
  border-radius: 12px;
  background: #fafafa;
  color: #111827;
  font-size: 14px;
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

.video-dialogue__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.video-dialogue__footer-left {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.video-dialogue__model-wrap {
  position: relative;
  flex-shrink: 0;
}

.video-dialogue__model {
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

.video-dialogue__model--active {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.video-dialogue__model-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath fill='%237c8cff' d='M7 1.5 8.3 5 11.8 6.3 8.3 7.6 7 11.1 5.7 7.6 2.2 6.3 5.7 5z'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}

.video-dialogue__model-caret {
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 6.25 5 3.75 7.5 6.25'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.video-dialogue__model-menu {
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

.video-dialogue__model-item {
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

.video-dialogue__model-item--active {
  background: #f3f4f6;
}

.video-dialogue__model-item-icon {
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

  &[data-icon='seedream'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='M4 13V8M9 13V5M14 13v-3'/%3E%3C/svg%3E");
  }

  &[data-icon='seedance'],
  &[data-icon='kling'],
  &[data-icon='happy-horse'],
  &[data-icon='wan'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='M4 13V8M9 13V5M14 13v-3'/%3E%3C/svg%3E");
  }
}

.video-dialogue__model-item-name {
  flex: 1;
  min-width: 0;
  color: #374151;
  font-size: 13px;
  line-height: 1.3;
  word-break: break-all;
}

.video-dialogue__tools,
.video-dialogue__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.video-dialogue__tool {
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

.video-dialogue__tool-icon {
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

.video-dialogue__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.video-dialogue__credits {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.video-dialogue__credits-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%23f59e0b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M7.5 1.5 8.8 5.2l3.9.3-3 2.3 1.1 3.8L7.5 9.6 3.2 11.6l1.1-3.8-3-2.3 3.9-.3z'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}

.video-dialogue__send {
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

  &:hover {
    background: #1f2937;
  }
}

.video-dialogue__send-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.4' d='M7 10V4M4.5 6.5 7 4l2.5 2.5'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}
</style>
