<template>
  <footer
    class="chat-panel__composer"
    @dragover.prevent
    @drop.prevent="emit('composer-drop', $event)"
  >
    <div class="panel__composer_box">
      <div
        v-if="showSkillMenu"
        class="chat-panel__skill-picker"
        @mousedown.stop
      >
        <div class="chat-panel__skill-picker-head">
          <span class="chat-panel__skill-picker-title">已启用 Skill</span>
          <!-- <button type="button" class="chat-panel__skill-picker-create" @click="onCreateSkill">
            + 创建
          </button> -->
        </div>
        <ul class="chat-panel__skill-picker-list">
          <li
            v-for="skill in filteredChatSkills"
            :key="skill.id"
            class="chat-panel__skill-picker-item"
            :class="{ 'chat-panel__skill-picker-item--hover': hoveredSkill?.id === skill.id }"
            @mouseenter="emit('skill-item-enter', $event, skill)"
            @mouseleave="emit('skill-item-leave')"
            @mousedown.prevent
            @click="emit('select-skill', skill)"
          >
            <span class="chat-panel__skill-picker-name">{{ skill.displayName }}</span>
            <span class="chat-panel__skill-picker-cmd" v-if="skill.description">/{{ skill.command }}</span>
            <span
              v-if="skill.description"
              class="chat-panel__skill-picker-desc"
            >{{ skill.description }}</span>
          </li>
          <li v-if="!filteredChatSkills.length" class="chat-panel__skill-picker-empty">暂无可用 Skill</li>
        </ul>
        <!-- <div class="chat-panel__skill-picker-foot">
          <button type="button" class="chat-panel__skill-picker-foot-item" @click="onAddSkill">
            <span class="chat-panel__skill-picker-foot-icon" data-icon="plus" aria-hidden="true" />
            添加技能
            <span class="chat-panel__skill-picker-foot-chevron" aria-hidden="true" />
          </button>
          <button type="button" class="chat-panel__skill-picker-foot-item" @click="onManageSkill">
            <span class="chat-panel__skill-picker-foot-icon" data-icon="settings" aria-hidden="true" />
            管理 Skill
          </button>
        </div> -->
      </div>

      <Teleport to="body">
        <div
          v-if="hoveredSkill && showSkillMenu && skillTooltipText"
          class="chat-panel__skill-tooltip"
          :style="skillTooltipStyle"
        >
          {{ skillTooltipText }}
        </div>
      </Teleport>

      <div v-if="selectedSkill" class="chat-panel__skill-chip-row">
        <span
          class="chat-panel__skill-chip"
          :class="{ 'chat-panel__skill-chip--selected': skillChipSelected }"
          role="button"
          tabindex="0"
          title="点击选中，按 Delete 删除"
          @click.stop="emit('select-skill-chip')"
          @keydown.enter.prevent="emit('select-skill-chip')"
          @keydown.space.prevent="emit('select-skill-chip')"
        >/{{ selectedSkill.displayName }}</span>
        <!-- <span v-if="!message.trim()" class="chat-panel__skill-tab-hint">Tab</span> -->
      </div>

      <div v-if="assetMentions.length" class="chat-panel__asset-mentions">
        <span
          v-for="mention in assetMentions"
          :key="mention.id"
          class="chat-panel__asset-mention"
        >
          <span class="chat-panel__asset-mention-at">@</span>
          <span class="chat-panel__asset-mention-role">{{ mention.role }}</span>
          <span class="chat-panel__asset-mention-name">{{ mention.name }}</span>
          <button
            type="button"
            class="chat-panel__asset-mention-remove"
            title="移除引用"
            aria-label="移除引用"
            @click="emit('remove-asset-mention', mention.id)"
          >
            ×
          </button>
        </span>
      </div>

      <div v-if="attachments.length" class="chat-panel__attachments">
        <div
          v-for="attachment in attachments"
          :key="attachment.id"
          class="chat-panel__attachment"
        >
          <img :src="attachment.previewUrl" :alt="attachment.fileName" class="chat-panel__attachment-img" />
          <span
            v-if="attachment.uploading"
            class="chat-panel__attachment-uploading"
            aria-label="上传中"
          />
          <span
            v-else-if="attachment.uploadError"
            class="chat-panel__attachment-error"
            :title="attachment.uploadError"
            aria-label="上传失败"
          />
          <button
            type="button"
            class="chat-panel__attachment-remove"
            title="移除附件"
            @click="emit('remove-attachment', attachment.id)"
          >
            ×
          </button>
        </div>
      </div>

      <textarea
        ref="inputRef"
        v-model="messageModel"
        class="chat-panel__input"
        :placeholder="inputPlaceholder"
        rows="3"
        @input="emit('message-input', $event)"
        @keydown="emit('composer-keydown', $event)"
      />

      <div class="chat-panel__composer-bar">
        <input
          ref="fileInputRef"
          type="file"
          class="chat-panel__file-input"
          accept="image/*"
          multiple
          @change="emit('file-input-change', $event)"
        />
        <button type="button" class="chat-panel__icon-btn chat-panel__icon-btn--sm" title="上传图片" @click="emit('open-file-picker')">
          <span class="chat-panel__icon chat-panel__icon--plus" aria-hidden="true" />
        </button>
        <span class="chat-panel__composer-divider" aria-hidden="true" />
        <div class="chat-panel__model-wrap" style="display: none;">
          <button
            type="button"
            class="chat-panel__meta-btn"
            :class="{ 'chat-panel__meta-btn--active': showModelMenu }"
            @click="emit('toggle-model-menu')"
          >
            {{ modelButtonLabel }}
          </button>
          <div
            v-if="showModelMenu"
            class="chat-panel__model-picker"
            @mousedown.stop
          >
            <div class="chat-panel__model-picker-head">
              <span class="chat-panel__model-picker-title">模型</span>
              <label class="chat-panel__model-picker-all">
                <span>全选</span>
                <input
                  type="checkbox"
                  class="chat-panel__model-picker-switch"
                  :checked="isAllModelsSelectedInTab"
                  @change="emit('toggle-select-all-models')"
                />
              </label>
            </div>
            <div class="chat-panel__model-picker-tabs">
              <button
                v-for="tab in modelCategoryTabs"
                :key="tab.key"
                type="button"
                class="chat-panel__model-picker-tab"
                :class="{ 'chat-panel__model-picker-tab--active': activeModelCategory === tab.key }"
                @click="emit('update:activeModelCategory', tab.key)"
              >
                {{ tab.label }}
              </button>
            </div>
            <ul class="chat-panel__model-picker-list">
              <li
                v-for="model in modelsInActiveCategory"
                :key="model.key"
                class="chat-panel__model-picker-item"
                @mousedown.prevent
                @click="emit('toggle-model-selection', model.key)"
              >
                <span
                  class="chat-panel__model-picker-icon"
                  :class="{ 'chat-panel__model-picker-icon--font': isDialogueModelIconfont(model.icon) }"
                  :data-icon="isDialogueModelIconfont(model.icon) ? undefined : model.icon"
                  aria-hidden="true"
                >
                  <i
                    v-if="isDialogueModelIconfont(model.icon)"
                    class="iconfont"
                    :class="normalizeDialogueModelIcon(model.icon)"
                  />
                </span>
                <span class="chat-panel__model-picker-main">
                  <span class="chat-panel__model-picker-name">{{ model.label }}</span>
                  <span v-if="model.subtitle" class="chat-panel__model-picker-sub">{{ model.subtitle }}</span>
                </span>
                <span
                  v-if="selectedModelKeys.has(model.key)"
                  class="chat-panel__model-picker-check"
                  aria-hidden="true"
                />
              </li>
              <li v-if="!modelsInActiveCategory.length" class="chat-panel__model-picker-empty">暂无模型</li>
            </ul>
          </div>
        </div>
        <div class="chat-panel__skill-wrap">
          <button
            type="button"
            class="chat-panel__meta-btn"
            :class="{ 'chat-panel__meta-btn--active': showSkillMenu }"
            @click="emit('toggle-skill-menu')"
          >
            Skill
          </button>
        </div>

        <div class="chat-panel__auto-wrap">
          <!-- <button type="button" class="chat-panel__auto-btn" @click="showAutoMenu = !showAutoMenu">
            {{ autoModeLabel }}
            <span class="chat-panel__caret" aria-hidden="true" />
          </button>
          <div v-if="showAutoMenu" class="chat-panel__auto-menu">
            <button
              v-for="mode in autoModes"
              :key="mode.value"
              type="button"
              class="chat-panel__auto-item"
              :class="{ 'chat-panel__auto-item--active': mode.value === autoMode }"
              @click="selectAutoMode(mode.value)"
            >
              {{ mode.label }}
            </button>
          </div> -->
        </div>

        <button
          v-if="isStreaming || isProcessing"
          type="button"
          class="chat-panel__stop"
          title="停止"
          aria-label="停止"
          @click="emit('stop')"
        >
          <span class="chat-panel__stop-icon" aria-hidden="true" />
        </button>
        <button
          v-else
          type="button"
          class="chat-panel__send"
          @click="emit('send')"
          :disabled="!canSend || isStreaming || isProcessing"
          title="发送"
          aria-label="发送"
        >
          <span class="chat-panel__send-icon" aria-hidden="true" />
        </button>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
import {
  isDialogueModelIconfont,
  normalizeDialogueModelIcon,
} from '@/components/Canvas/constants'
import type { ChatAttachment } from '../../chatTypes'

interface SkillItem {
  id: string
  name?: string
  displayName?: string
  command?: string
  description?: string
  detail?: string
  [key: string]: unknown
}

interface AssetMention {
  id: string
  role: string
  name: string
}

interface ModelCategoryTab {
  key: string
  label: string
}

interface ChatModelItem {
  key: string
  label: string
  subtitle?: string
  icon: string
}

const props = defineProps<{
  showSkillMenu: boolean
  filteredChatSkills: SkillItem[]
  hoveredSkill?: SkillItem | null
  skillTooltipText?: string
  skillTooltipStyle?: CSSProperties
  selectedSkill?: SkillItem | null
  skillChipSelected: boolean
  assetMentions: AssetMention[]
  attachments: ChatAttachment[]
  message: string
  inputPlaceholder: string
  showModelMenu: boolean
  modelButtonLabel: string
  isAllModelsSelectedInTab: boolean
  modelCategoryTabs: ModelCategoryTab[]
  activeModelCategory: string
  modelsInActiveCategory: ChatModelItem[]
  selectedModelKeys: Set<string>
  isStreaming: boolean
  isSending: boolean
  isProcessing: boolean
  canSend: boolean
}>()

const emit = defineEmits<{
  'composer-drop': [event: DragEvent]
  'skill-item-enter': [event: MouseEvent, skill: SkillItem]
  'skill-item-leave': []
  'select-skill': [skill: SkillItem]
  'select-skill-chip': []
  'remove-asset-mention': [id: string]
  'remove-attachment': [id: string]
  'update:message': [value: string]
  'message-input': [event: Event]
  'composer-keydown': [event: KeyboardEvent]
  'file-input-change': [event: Event]
  'open-file-picker': []
  'toggle-model-menu': []
  'toggle-select-all-models': []
  'update:activeModelCategory': [category: string]
  'toggle-model-selection': [key: string]
  'toggle-skill-menu': []
  stop: []
  send: []
}>()

const messageModel = computed({
  get: () => props.message,
  set: (value: string) => emit('update:message', value),
})

const inputRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

defineExpose({ inputRef, fileInputRef })
</script>
