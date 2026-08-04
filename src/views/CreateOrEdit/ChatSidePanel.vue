<template>
  <aside
    class="chat-panel"
    :class="{ 'chat-panel--collapsed': collapsed, 'chat-panel--active': isActive, 'chat-panel--dark': isDarkTheme }"
    aria-label="对话面板"
  >
    <header class="chat-panel__header">
      <div class="chat-panel__tabs" role="tablist">
        <div
          v-for="tab in openTabs"
          :key="tab.id"
          class="chat-panel__tab"
          :class="{ 'chat-panel__tab--active': tab.id === activeSessionId }"
          role="tab"
          :aria-selected="tab.id === activeSessionId"
          @click="switchSession(tab.id)"
        >
          <span class="chat-panel__tab-title">{{ tab.title }}</span>
          <button
            type="button"
            class="chat-panel__tab-close"
            title="关闭标签"
            aria-label="关闭标签"
            @click.stop="closeTab(tab.id)"
          >
            ×
          </button>
        </div>
      </div>
      <div class="chat-panel__header-actions">
        <button type="button" class="chat-panel__icon-btn" title="新建对话" aria-label="新建对话" @click="startNewChat">
          <span class="chat-panel__icon chat-panel__icon--plus" aria-hidden="true" />
        </button>
        <div class="chat-panel__history-wrap">
          <button
            type="button"
            class="chat-panel__icon-btn"
            title="历史记录"
            aria-label="历史记录"
            @click="toggleHistoryMenu"
          >
            <span class="chat-panel__icon chat-panel__icon--history" aria-hidden="true" />
          </button>
          <div v-if="showHistoryMenu" class="chat-panel__history-menu">
            <input
              v-model="historySearch"
              type="search"
              class="chat-panel__history-search"
              placeholder="搜索对话..."
            />
            <ul class="chat-panel__history-list">
              <li
                v-for="item in historySessions ?? []"
                :key="item.id"
                class="chat-panel__history-item"
                @click="openFromHistory(item)"
              >
                <span class="chat-panel__history-name">{{ item.title }}</span>
                <span class="chat-panel__history-meta">
                  <span v-if="item.id === currentSessionId" class="chat-panel__history-badge">已打开</span>
                  <span class="chat-panel__history-time">{{ dayjs(item.updatedAt).format('YYYY-MM-DD HH:mm:ss') }}</span>
                </span>
              </li>
              <li v-if="!(historySessions ?? []).length" class="chat-panel__history-empty">暂无对话</li>
            </ul>
          </div>
        </div>
        <button
          type="button"
          class="chat-panel__icon-btn"
          title="关闭"
          aria-label="关闭"
          @click="emit('close-chat')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            aria-hidden="true"
            role="img"
            class="iconify iconify--libtv pointer-events-none text-current"
            width="14"
            height="14"
            viewBox="0 0 16 16"
          >
            <g transform="translate(2.1674 2.1675)">
              <path d="M0.523438 0C0.812784 6.62772e-05 1.04768 0.234117 1.04785 0.523438V11.1406C1.04774 11.43 0.812825 11.665 0.523438 11.665C0.234144 11.6649 0.000109648 11.4299 0 11.1406V0.523438C0.000175989 0.234185 0.234185 0.000175989 0.523438 0ZM6.78809 1.47949C6.99276 1.27491 7.32558 1.27495 7.53027 1.47949L11.5117 5.46094C11.7163 5.66563 11.7163 5.99845 11.5117 6.20312L7.53027 10.1846C7.32559 10.3891 6.99277 10.3891 6.78809 10.1846C6.58356 9.97989 6.58355 9.64706 6.78809 9.44238L9.875 6.35645H3.17773C2.88835 6.35637 2.65341 6.12142 2.65332 5.83203C2.65344 5.54267 2.88837 5.3077 3.17773 5.30762H9.875L6.78809 2.22168C6.58353 2.01697 6.58346 1.68416 6.78809 1.47949Z" fill="currentColor"></path>
            </g>
          </svg>
        </button>
      </div>
    </header>

    <div v-show="!collapsed" class="chat-panel__body">
      <section v-if="!isActive" class="chat-panel__welcome">
        <p class="chat-panel__greeting">Hi，用对话开启创作</p>
        <p class="chat-panel__sub-greeting">或来试一试这些 skill</p>

        <div class="chat-panel__skills">
          <button
            v-for="skill in skills"
            :key="skill.id"
            type="button"
            class="chat-panel__skill-btn"
            @click="selectWelcomeSkill(skill)"
          >
            {{ skill.displayName }}
          </button>
        </div>

        <!-- <p class="chat-panel__hint">你也可以直接拖入 .md 文件导入你的 skill</p> -->
      </section>

      <section v-else ref="messagesRef" class="chat-panel__messages">
        <article
          v-for="item in messages"
          :key="item.id"
          class="chat-panel__message"
          :class="`chat-panel__message--${item.role}`"
        >
          <template v-if="item.kind === 'balance_error'">
            <div class="chat-panel__balance-card">
              <div class="chat-panel__balance-head">
                <span class="chat-panel__balance-icon" aria-hidden="true" />
                <span class="chat-panel__balance-title">余额不足 需要处理</span>
                <span class="chat-panel__balance-caret" aria-hidden="true" />
              </div>
              <p class="chat-panel__balance-desc">余额不足，请充值后重试。</p>
              <button type="button" class="chat-panel__balance-action">
                充值
                <span class="chat-panel__balance-link-icon" aria-hidden="true" />
              </button>
            </div>
          </template>
          <template v-else>
            <div v-if="item.attachments?.length" class="chat-panel__message-attachments">
              <img
                v-for="attachment in item.attachments"
                :key="attachment.id"
                :src="attachment.previewUrl"
                :alt="attachment.fileName"
                class="chat-panel__message-thumb"
              />
            </div>
            <div v-if="item.text" class="chat-panel__message-bubble">
              <p class="chat-panel__message-text">
                {{ item.text }}<span
                  v-if="item.role === 'assistant' && streamingMessageIds.has(item.id)"
                  class="chat-panel__stream-caret"
                  aria-hidden="true"
                />
              </p>
            </div>
            <div
              v-if="item.questionnaire && !item.questionnaireAnswered"
              class="chat-panel__questionnaire"
            >
              <button
                v-for="option in item.questionnaire.options"
                :key="option.value"
                type="button"
                class="chat-panel__questionnaire-option"
                :disabled="isStreaming || isSending"
                @click="onQuestionnaireSelect(item, option)"
              >
                <span class="chat-panel__questionnaire-option-label">{{ option.label }}</span>
                <span
                  v-if="option.description"
                  class="chat-panel__questionnaire-option-desc"
                >{{ option.description }}</span>
              </button>
            </div>
            <button
              v-if="item.role === 'user' && item.text"
              type="button"
              class="chat-panel__copy-btn"
              title="复制"
              aria-label="复制"
              @click="copyMessage(item.text)"
            >
              <span class="chat-panel__copy-icon" aria-hidden="true" />
            </button>
            <p v-if="item.tip" class="chat-panel__message-tip">{{ item.tip }}</p>
          </template>
        </article>
      </section>

      <footer
        class="chat-panel__composer"
        @dragover.prevent
        @drop.prevent="onComposerDrop"
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
                @mouseenter="onSkillItemEnter($event, skill)"
                @mouseleave="onSkillItemLeave"
                @mousedown.prevent
                @click="selectChatSkill(skill)"
              >
                <span class="chat-panel__skill-picker-name">{{ skill.name }}</span>
                <span class="chat-panel__skill-picker-cmd">/{{ skill.command }}</span>
                <span class="chat-panel__skill-picker-desc">{{ skill.description }}</span>
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
              v-if="hoveredSkill && showSkillMenu"
              class="chat-panel__skill-tooltip"
              :style="skillTooltipStyle"
            >
              {{ hoveredSkill.detail || hoveredSkill.description }}
            </div>
          </Teleport>

          <div v-if="selectedSkill" class="chat-panel__skill-chip-row">
            <span
              class="chat-panel__skill-chip"
              :class="{ 'chat-panel__skill-chip--selected': skillChipSelected }"
              role="button"
              tabindex="0"
              title="点击选中，按 Delete 删除"
              @click.stop="selectSkillChip"
              @keydown.enter.prevent="selectSkillChip"
              @keydown.space.prevent="selectSkillChip"
            >/{{ selectedSkill.displayName }}</span>
            <span v-if="!message.trim()" class="chat-panel__skill-tab-hint">Tab</span>
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
                @click="removeAssetMention(mention.id)"
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
                @click="removeAttachment(attachment.id)"
              >
                ×
              </button>
            </div>
          </div>

          <textarea
            ref="inputRef"
            v-model="message"
            class="chat-panel__input"
            :placeholder="inputPlaceholder"
            rows="3"
            @input="onMessageInput"
            @keydown="onComposerKeydown"
          />

          <div class="chat-panel__composer-bar">
            <input
              ref="fileInputRef"
              type="file"
              class="chat-panel__file-input"
              accept="image/*,.md"
              multiple
              @change="onFileInputChange"
            />
            <button type="button" class="chat-panel__icon-btn chat-panel__icon-btn--sm" title="添加附件" @click="openFilePicker">
              <span class="chat-panel__icon chat-panel__icon--plus" aria-hidden="true" />
            </button>
            <span class="chat-panel__composer-divider" aria-hidden="true" />
            <div class="chat-panel__model-wrap">
              <button
                type="button"
                class="chat-panel__meta-btn"
                :class="{ 'chat-panel__meta-btn--active': showModelMenu }"
                @click="toggleModelMenu"
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
                      @change="toggleSelectAllModelsInTab"
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
                    @click="activeModelCategory = tab.key"
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
                    @click="toggleModelSelection(model.key)"
                  >
                    <span
                      class="chat-panel__model-picker-icon"
                      :data-icon="model.icon"
                      aria-hidden="true"
                    />
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
                @click="toggleSkillMenu"
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
              @click="stopProcessing"
            >
              <span class="chat-panel__stop-icon" aria-hidden="true" />
            </button>
            <button
              v-else
              type="button"
              class="chat-panel__send"
              @click="sendMessage"
              :disabled="!canSend || isStreaming || isProcessing"
              title="发送"
              aria-label="发送"
            >
              <span class="chat-panel__send-icon" aria-hidden="true" />
            </button>
          </div>
        </div>
      </footer>
    </div>

    <button
      v-if="collapsed"
      type="button"
      class="chat-panel__expand"
      title="展开面板"
      aria-label="展开面板"
      @click="collapsed = false"
    >
      <span class="chat-panel__icon chat-panel__icon--expand" aria-hidden="true" />
    </button>
  </aside>
  <button
    v-if="collapsed"
    type="button"
    class="chat-panel__msg-icon"
    :class="{ 'chat-panel__msg-icon--light': isLightTheme }"
    title="展开面板"
    aria-label="展开面板"
    @click="onTargetCollapse"
  >
    <img :src="logoSrc" alt="logo" class="chat-panel__msg-icon-logo" />
  </button>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import logoWhite from '@assets/images/logo_white.png'
import logoBlack from '@assets/images/logo_black.png'
import { useCanvasBgTheme } from '@/components/Canvas/useCanvasBgTheme'
import {
  listImageDialogueModelEntries,
  listVideoDialogueModelEntries,
  type ImageCapability,
  type ChatTools,
} from '@/components/Canvas/constants'
import type { ChatAttachment, ChatMessage, ChatSendPayload, ChatSession, Questionnaire, QuestionnaireOption } from './chatTypes'
import { CHAT_TIPS } from './chatTypes'
import { useSSE } from '@/hooks/useSSE'
import { getToken } from '@/utils/request'
import api from '@/services/api';
import { uploadAssetFile } from '@/components/Canvas/upload'
import dayjs from 'dayjs'

const props = defineProps<{
  projectId?: string,
  historySessions?: any[]
  currentSessionId?: string,
  sessionName?: string
  chatTools?: any[]
  aiSkills?: any[]
}>()

const API_BASE = 'https://api.dev.daoneai.com/api/v1';

const { loading, connected, connect, close } = useSSE()
const isStreaming = computed(() => loading.value || connected.value)

const AUTO_MODE_MODELS: Record<string, string> = {
  Auto: 'gpt5.5',
  Fast: 'gpt5.5',
  Quality: 'Codex',
}

const skills = computed(() => (props.aiSkills ?? []).filter((item: any) => item.category == "CUSTOM"))

const filteredChatSkills = computed(() => (props.aiSkills ?? []).filter((item: any) => item.category == "ecommerce"))

type ChatModelCategory = 'image' | 'video' | 'audio'

interface ChatModelItem {
  key: string
  category: ChatModelCategory
  value: string
  label: string
  subtitle?: string
  icon: string
}

interface ChatSkillItem {
  id: string
  name: string
  command: string
  description: string
  detail?: string
}

const MODEL_CATEGORY_TABS: { key: ChatModelCategory; label: string }[] = [
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  // { key: 'audio', label: '音频' },
]

const emit = defineEmits<{
  send: [payload: ChatSendPayload],
  'set-current-session-id': [sessionId: string],
  'load-history-sessions': [],
  'new-chat': [],
  'set-session-name': [name: string],
  'close-chat': [],
}>()

const onTargetCollapse = () => {
  collapsed.value = false
}

const collapsed = defineModel<boolean>('collapsed', { required: true })

const message = ref('')
const autoMode = ref('Auto')
const showAutoMenu = ref(false)
const showHistoryMenu = ref(false)
const showModelMenu = ref(false)
const showSkillMenu = ref(false)
const skillMenuFromButton = ref(false)
const activeModelCategory = ref<ChatModelCategory>('image')
const selectedModelKeys = ref<Set<string>>(new Set())
const selectedSkill = ref<any>(null)
const skillChipSelected = ref(false)
const hoveredSkill = ref<any>(null)
const skillTooltipStyle = ref<Record<string, string>>({})
const historySearch = ref('')
const isProcessing = ref(false)
const isSending = ref(false)
const sessions = ref<ChatSession[]>([])
const activeSessionId = ref('')
const attachments = ref<ChatAttachment[]>([])
const assetMentions = ref<Array<{ id: string; role: string; name: string }>>([])
const inputRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const messagesRef = ref<HTMLElement | null>(null)

const openTabs = computed(() => sessions.value.filter((item) => item.isOpen))

const activeSession = computed(() =>
  sessions.value.find((item) => item.id === activeSessionId.value) ?? null,
)

const messages = computed(() => activeSession.value?.messages ?? [])

const isActive = computed(() => messages.value.length > 0)

function getSelectedSkillDescription(): string {
  const skill = selectedSkill.value
  if (!skill) return ''
  return String(skill.description ?? skill.detail ?? '').trim()
}

const inputPlaceholder = computed(() => {
  if (isActive.value) return '可继续输入，将排队发送...'
  const description = getSelectedSkillDescription()
  if (description) return description
  return '输入消息...'
})

const canSend = computed(() => {
  const hasContent = Boolean(
    message.value.trim() || attachments.value.length || assetMentions.value.length || selectedSkill.value,
  )
  const attachmentsReady = attachments.value.every((item) => {
    if (!item.file.type.startsWith('image/')) return true
    if (item.assetId) return true
    return !item.uploading && !item.uploadError
  })
  return hasContent && attachmentsReady
})

const chatToolsData = computed(() => (props.chatTools ?? {}) as ChatTools)

const modelCategoryTabs = computed(() => MODEL_CATEGORY_TABS)

const allChatModels = computed<ChatModelItem[]>(() => {
  const tools = chatToolsData.value
  const imageModels = parseModelsFromCapability(tools.image, 'image', 'image')
  const videoModels = parseModelsFromCapability(tools.video, 'video', 'video')
  const audioModels = parseModelsFromCapability(tools.text, 'audio', 'audio')
  return [...imageModels, ...videoModels, ...audioModels]
})

const modelsInActiveCategory = computed(() =>
  allChatModels.value.filter((item) => item.category === activeModelCategory.value),
)

const modelButtonLabel = computed(() => {
  const count = selectedModelKeys.value.size
  return count > 0 ? `模型 · ${count}` : '模型'
})

const isAllModelsSelectedInTab = computed(() => {
  const models = modelsInActiveCategory.value
  if (!models.length) return false
  return models.every((item) => selectedModelKeys.value.has(item.key))
})

const { isLightTheme } = useCanvasBgTheme()
const isDarkTheme = computed(() => !isLightTheme.value)
const logoSrc = computed(() => (isLightTheme.value ? logoBlack : logoWhite))

function createSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseModelsFromCapability(
  capability: ImageCapability | null | undefined,
  category: ChatModelCategory,
  icon: string,
): ChatModelItem[] {
  if (!capability?.parameters) return []

  if (category === 'image') {
    return listImageDialogueModelEntries({ image: capability }).map((entry) => ({
      key: `image:${entry.key}`,
      category,
      value: entry.key,
      label: entry.label,
      subtitle: entry.resolutions[entry.resolutions.length - 1] || undefined,
      icon,
    }))
  }

  if (category === 'video') {
    return listVideoDialogueModelEntries({ video: capability }).map((entry) => ({
      key: `video:${entry.key}`,
      category,
      value: entry.key,
      label: entry.label,
      subtitle: entry.resolutions[entry.resolutions.length - 1]?.label || undefined,
      icon,
    }))
  }

  const params = capability.parameters
  const models = params.models
  if (Array.isArray(models) && models.length) {
    const result: ChatModelItem[] = []
    models.forEach((item) => {
      if (!item || typeof item !== 'object') return
      const row = item as Record<string, unknown>
      const value = String(row.value ?? row.key ?? row.id ?? row.model ?? '').trim()
      if (!value) return
      const label = String(row.label ?? row.name ?? row.title ?? value).trim()
      result.push({
        key: `${category}:${value}`,
        category,
        value,
        label,
        icon,
      })
    })
    return result
  }

  const legacyModels = params.model
  if (!Array.isArray(legacyModels)) return []
  return legacyModels
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .map((value) => ({
      key: `${category}:${value}`,
      category,
      value,
      label: value,
      icon,
    }))
}

function detectSlashQuery(text: string) {
  const match = text.match(/(?:^|\s)\/([a-zA-Z0-9-]*)$/)
  return match ? match[1] : null
}

function closeModelMenu() {
  showModelMenu.value = false
}

function closeSkillMenu() {
  showSkillMenu.value = false
  skillMenuFromButton.value = false
  hoveredSkill.value = null
}

function toggleModelMenu() {
  showModelMenu.value = !showModelMenu.value
  if (showModelMenu.value) {
    closeSkillMenu()
    showAutoMenu.value = false
  }
}

function toggleSkillMenu() {
  const next = !showSkillMenu.value
  showSkillMenu.value = next
  skillMenuFromButton.value = next
  if (next) {
    closeModelMenu()
    showAutoMenu.value = false
  } else {
    hoveredSkill.value = null
  }
}

function toggleModelSelection(key: string) {
  const next = new Set(selectedModelKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedModelKeys.value = next
}

function toggleSelectAllModelsInTab() {
  const models = modelsInActiveCategory.value
  if (!models.length) return
  const next = new Set(selectedModelKeys.value)
  const shouldSelectAll = !isAllModelsSelectedInTab.value
  models.forEach((item) => {
    if (shouldSelectAll) next.add(item.key)
    else next.delete(item.key)
  })
  selectedModelKeys.value = next
}

function resolveEnabledSkill(skill: any) {
  const name = String(skill?.name ?? skill?.skillName ?? '').trim()
  if (!name) return skill
  return filteredChatSkills.value.find((item: any) => item.name === name) ?? skill
}

function selectChatSkill(skill: ChatSkillItem | Record<string, any>) {
  selectedSkill.value = skill
  skillChipSelected.value = false
  message.value = message.value.replace(/(^|\s)\/[a-zA-Z0-9-]*$/, '').trimStart()
  closeSkillMenu()
  focusInput()
}

function selectWelcomeSkill(skill: Record<string, any>) {
  ensureActiveSession()
  selectChatSkill(resolveEnabledSkill(skill))
}

function selectSkillChip() {
  skillChipSelected.value = true
  focusInput()
}

function clearSelectedSkill() {
  selectedSkill.value = null
  skillChipSelected.value = false
}

function onSkillItemEnter(event: MouseEvent, skill: ChatSkillItem) {
  hoveredSkill.value = skill
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const rect = target.getBoundingClientRect()
  skillTooltipStyle.value = {
    top: `${rect.top + rect.height / 2}px`,
    left: `${rect.left - 12}px`,
    transform: 'translate(-100%, -50%)',
  }
}

function onSkillItemLeave() {
  hoveredSkill.value = null
}

function onMessageInput() {
  skillChipSelected.value = false
  const slashQuery = detectSlashQuery(message.value)
  if (slashQuery !== null || message.value === '/') {
    showSkillMenu.value = true
    closeModelMenu()
    showAutoMenu.value = false
    return
  }
  if (!skillMenuFromButton.value) {
    closeSkillMenu()
  }
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Backspace' || event.key === 'Delete') {
    if (selectedSkill.value && skillChipSelected.value) {
      event.preventDefault()
      clearSelectedSkill()
      return
    }

    const input = inputRef.value
    if (
      selectedSkill.value
      && input
      && input.selectionStart === 0
      && input.selectionEnd === 0
      && !message.value.trim()
    ) {
      event.preventDefault()
      clearSelectedSkill()
      return
    }
  }

  if (event.key === 'Tab' && selectedSkill.value && !message.value.trim()) {
    const description = getSelectedSkillDescription()
    if (description) {
      event.preventDefault()
      message.value = description
      focusInput()
    }
    return
  }
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    sendMessage()
  }
}

function createEmptyDraft() {
  return {
    message: '',
    attachments: [] as ChatAttachment[],
    assetMentions: [] as Array<{ id: string; role: string; name: string }>,
  }
}

function createSession(title = '新建对话', isOpen = true): ChatSession {
  const now = Date.now()
  return {
    id: createSessionId(),
    chatId: null,
    title,
    messages: [],
    draft: createEmptyDraft(),
    isOpen,
    createdAt: now,
    updatedAt: now,
  }
}

function createSessionFromHistory(item: {
  id: string
  title?: string
  createdAt?: string
  updatedAt?: string
}): ChatSession {
  return {
    id: item.id,
    chatId: item.id,
    title: item.title || '未命名对话',
    messages: [],
    draft: createEmptyDraft(),
    isOpen: true,
    createdAt: item.createdAt ? Date.parse(item.createdAt) || Date.now() : Date.now(),
    updatedAt: item.updatedAt ? Date.parse(item.updatedAt) || Date.now() : Date.now(),
  }
}

const messageLoadSeqByChatId = new Map<string, number>()

async function loadSessionMessages(session: ChatSession) {
  const chatId = session.chatId || session.id
  if (!chatId) return

  const seq = (messageLoadSeqByChatId.get(chatId) ?? 0) + 1
  messageLoadSeqByChatId.set(chatId, seq)

  try {
    const res = await api.getChatMessages<{
      id: string
      role: string
      content: string
      createdAt?: string
      agentActions?: StreamEvent['agentActions']
      agentStatus?: string
    }>(chatId, { page: 1, pageSize: 100 })

    // 过期请求 / 正在发送或流式中，禁止覆盖本地消息
    if (messageLoadSeqByChatId.get(chatId) !== seq) return
    if (isStreaming.value || isSending.value) return

    const live = sessions.value.find(
      (item) => item.id === session.id || item.chatId === chatId || item.id === chatId,
    )
    if (!live) return

    // 本地已有临时消息（发送中或流式中），保留本地，避免打回欢迎页
    const hasLocalPending = live.messages.some(
      (item) => item.id.startsWith('msg-') || streamingMessageIds.value.has(item.id),
    )
    if (hasLocalPending) return

    const records = res.records ?? []
    live.messages = records.map((item, index) => {
      const role = String(item.role || '').toUpperCase() === 'USER' ? 'user' : 'assistant'
      const questionnaire = role === 'assistant'
        ? extractQuestionnaireFromHistoryItem(item)
        : undefined
      const questionnaireAnswered = Boolean(
        questionnaire
        && records.slice(index + 1).some(
          (next) => String(next.role || '').toUpperCase() === 'USER',
        ),
      )

      return {
        id: item.id || `msg-${item.createdAt || Date.now()}`,
        role,
        text: item.content || '',
        kind: 'text' as const,
        questionnaire,
        questionnaireAnswered,
      }
    })
    scrollMessagesToBottom()
  } catch {
    // 拉取失败时保留本地消息，不打断面板
  }
}

function openSessionTab(historyItem: { id: string; title?: string; createdAt?: string; updatedAt?: string }, options?: {
  asDefault?: boolean
}) {
  const existing = sessions.value.find(
    (item) => item.id === historyItem.id || item.chatId === historyItem.id,
  )
  if (existing) {
    existing.isOpen = true
    existing.title = historyItem.title || existing.title
    // 本地会话 id 与服务端对齐，避免后续 watch 重复开 tab
    if (existing.chatId === historyItem.id && existing.id !== historyItem.id) {
      const oldId = existing.id
      existing.id = historyItem.id
      if (activeSessionId.value === oldId) {
        activeSessionId.value = existing.id
      }
    } else {
      activeSessionId.value = existing.id
    }
    loadSessionDraft(existing)
    // 本地已有消息或正在流式输出时，不要被历史拉取覆盖
    if (!existing.messages.length && !isStreaming.value && !isSending.value) {
      void loadSessionMessages(existing)
    }
    return existing
  }

  const session = createSessionFromHistory(historyItem)

  if (options?.asDefault) {
    const emptyNew = sessions.value.find(
      (item) => item.title === '新建对话' && !item.messages.length && !item.chatId,
    )
    if (emptyNew) {
      sessions.value = sessions.value.map((item) => (item.id === emptyNew.id ? session : item))
    } else {
      sessions.value = [session, ...sessions.value.filter((item) => item.isOpen)]
    }
  } else {
    sessions.value.push(session)
  }

  activeSessionId.value = session.id
  loadSessionDraft(session)
  void loadSessionMessages(session)
  return session
}

function saveActiveDraft() {
  const session = activeSession.value
  if (!session) return
  session.draft = {
    message: message.value,
    attachments: attachments.value.map((item) => ({ ...item })),
    assetMentions: assetMentions.value.map((item) => ({ ...item })),
  }
}

function loadSessionDraft(session: ChatSession) {
  message.value = session.draft.message
  attachments.value = session.draft.attachments.map((item) => ({ ...item }))
  assetMentions.value = session.draft.assetMentions.map((item) => ({ ...item }))
}

function ensureActiveSession() {
  if (activeSession.value) return activeSession.value
  const session = createSession()
  sessions.value.push(session)
  activeSessionId.value = session.id
  loadSessionDraft(session)
  return session
}

function switchSession(sessionId: string) {
  if (sessionId === activeSessionId.value) return
  saveActiveDraft()
  const target = sessions.value.find((item) => item.id === sessionId)
  if (!target) return
  activeSessionId.value = sessionId
  loadSessionDraft(target)
  scrollMessagesToBottom()
}

function openFromHistory(session: any) {
  emit('set-current-session-id', session.id)
  emit('set-session-name', session.title || '未命名对话')
  showHistoryMenu.value = false
  openSessionTab(session)
  focusInput()
}

function closeTab(sessionId: string) {
  const target = sessions.value.find((item) => item.id === sessionId)
  if (!target) return

  target.draft.attachments.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  })

  target.isOpen = false

  if (!openTabs.value.length) {
    const session = createSession('新建对话', true)
    sessions.value.push(session)
    activeSessionId.value = session.id
    message.value = ''
    clearAttachments()
    clearAssetMentions()
    return
  }

  if (activeSessionId.value === sessionId) {
    const nextTab = openTabs.value[0]
    activeSessionId.value = nextTab.id
    loadSessionDraft(nextTab)
  }
}

function toggleHistoryMenu() {
  showHistoryMenu.value = !showHistoryMenu.value
  if (showHistoryMenu.value) {
    historySearch.value = ''
  }
}

function createAttachment(file: File, assetId?: string): ChatAttachment {
  const isImage = file.type.startsWith('image/')
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: isImage ? URL.createObjectURL(file) : '',
    fileName: file.name,
    assetId,
    uploading: isImage && !assetId ? true : undefined,
  }
}

function patchAttachment(id: string, patch: Partial<ChatAttachment>) {
  attachments.value = attachments.value.map((item) =>
    (item.id === id ? { ...item, ...patch } : item),
  )
}

async function uploadAttachmentToOss(attachmentId: string) {
  const attachment = attachments.value.find((item) => item.id === attachmentId)
  if (!attachment) return

  patchAttachment(attachmentId, { uploading: true, uploadError: undefined })

  try {
    const result = await uploadAssetFile(attachment.file, { projectId: props.projectId })
    const nextPreviewUrl = result.url || attachment.previewUrl
    if (result.url && attachment.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.previewUrl)
    }
    patchAttachment(attachmentId, {
      assetId: result.assetId,
      previewUrl: nextPreviewUrl,
      uploading: false,
      uploadError: undefined,
    })
  } catch (error) {
    patchAttachment(attachmentId, {
      uploading: false,
      uploadError: error instanceof Error ? error.message : '上传失败',
    })
  }
}

function clearAssetMentions() {
  assetMentions.value = []
}

function removeAssetMention(id: string) {
  assetMentions.value = assetMentions.value.filter((item) => item.id !== id)
}

function insertAssetMention(payload: { id: string; role: string; name: string }) {
  ensureActiveSession()
  if (assetMentions.value.some((item) => item.id === payload.id)) {
    focusInput()
    return
  }
  assetMentions.value = [...assetMentions.value, payload]
  focusInput()
}

function buildMessageText() {
  const mentionText = assetMentions.value
    .map((item) => `@${item.role} ${item.name}`)
    .join(' ')
  const skillPrefix = selectedSkill.value
    ? `/${selectedSkill.value.command || selectedSkill.value.name || selectedSkill.value.displayName}`
    : ''
  const body = message.value.trim()
  return [mentionText, skillPrefix, body].filter(Boolean).join(' ')
}

function addAttachments(files: File[], assetId?: string) {
  ensureActiveSession()
  files.forEach((file) => {
    if (!file.type.startsWith('image/') && !file.name.endsWith('.md')) return
    const attachment = createAttachment(file, assetId)
    attachments.value.push(attachment)
    if (file.type.startsWith('image/') && !assetId) {
      void uploadAttachmentToOss(attachment.id)
    }
  })
}

async function addAttachmentFromCanvas(payload: { previewUrl: string; fileName: string; assetId?: string }) {
  ensureActiveSession()
  if (!payload.previewUrl) return

  // 已存在相同资源时，仅聚焦输入框，避免重复添加
  if (attachments.value.some((item) => item.previewUrl === payload.previewUrl)) {
    focusInput()
    return
  }

  const fileName = payload.fileName || 'canvas-image.jpg'
  const assetId = payload.assetId || undefined

  try {
    const response = await fetch(payload.previewUrl, { mode: 'cors' })
    if (!response.ok) throw new Error(`fetch failed: ${response.status}`)
    const blob = await response.blob()
    const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })
    addAttachments([file], assetId)
  } catch (error) {
    // 跨域/网络失败时不静默丢弃，降级为远程链接附件，保证资源仍出现在对话框中
    console.warn('[ChatSidePanel] 拉取画布图片失败，降级为远程附件', error)
    attachments.value.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: new File([], fileName, { type: 'image/jpeg' }),
      previewUrl: payload.previewUrl,
      fileName,
      assetId,
    })
  }

  focusInput()
}

function addSkillFile(file: File, skillName?: string) {
  ensureActiveSession()
  if (!file.name.endsWith('.md')) return
  addAttachments([file])
  if (skillName) {
    message.value = `请使用技能「${skillName}」处理以下工作流`
  }
  focusInput()
}

function removeAttachment(id: string) {
  const target = attachments.value.find((item) => item.id === id)
  if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
  attachments.value = attachments.value.filter((item) => item.id !== id)
}

function clearAttachments() {
  attachments.value.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  })
  attachments.value = []
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  addAttachments(Array.from(input.files ?? []))
  input.value = ''
}

function onComposerDrop(event: DragEvent) {
  addAttachments(Array.from(event.dataTransfer?.files ?? []))
}

function scrollMessagesToBottom() {
  nextTick(() => {
    const el = messagesRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  })
}

function resolveModel(mode: string) {
  if (selectedModelKeys.value.size > 0) {
    const firstKey = Array.from(selectedModelKeys.value)[0]
    const model = allChatModels.value.find((item) => item.key === firstKey)
    if (model) return model.value
  }
  return AUTO_MODE_MODELS[mode] ?? 'gpt5.5'
}

type StreamEvent = {
  event?: string
  id?: string
  role?: string
  content?: string
  iteration?: number
  tool?: string
  arguments?: {
    question?: string
    content?: string
    text?: string
    questionnaire?: {
      step?: number
      totalSteps?: number
      allowCustom?: boolean
      options?: Array<{ label?: string; value?: string; description?: string }>
    }
    [key: string]: unknown
  }
  agentActions?: Array<{
    tool?: string
    type?: string
    status?: string
    summary?: string
    data?: {
      question?: string
      step?: number
      totalSteps?: number
      allowCustom?: boolean
      options?: Array<{ label?: string; value?: string; description?: string }>
    }
  }>
  agentStatus?: string
  success?: boolean
  summary?: string
  choices?: Array<{ delta?: { content?: string } }>
  delta?: { content?: string }
  message?: string
  text?: string
}

type QuestionnaireSource = {
  question?: string
  step?: number
  totalSteps?: number
  allowCustom?: boolean
  options?: Array<{ label?: string; value?: string; description?: string }>
}

function normalizeQuestionnaire(
  data: QuestionnaireSource | undefined,
  fallbackQuestion?: string,
): Questionnaire | undefined {
  if (!data?.options?.length) return undefined

  const options = data.options
    .filter((item): item is QuestionnaireOption => Boolean(item.label && item.value))
    .map((item) => ({
      label: item.label,
      value: item.value,
      description: item.description,
    }))

  if (!options.length) return undefined

  return {
    question: data.question || fallbackQuestion || '',
    step: data.step ?? 1,
    totalSteps: data.totalSteps ?? 1,
    allowCustom: data.allowCustom ?? false,
    options,
  }
}

function extractQuestionnaireFromStreamPayload(payload: StreamEvent): Questionnaire | undefined {
  if (payload.tool === 'ask_user' && payload.arguments?.questionnaire) {
    return normalizeQuestionnaire(payload.arguments.questionnaire, payload.arguments.question)
  }

  const action = payload.agentActions?.find(
    (item) => item.type === 'QUESTIONNAIRE' || item.tool === 'ask_user',
  )
  if (action?.data) {
    return normalizeQuestionnaire(action.data, action.summary || action.data.question)
  }

  return undefined
}

function extractQuestionnaireFromHistoryItem(item: {
  content?: string
  agentActions?: StreamEvent['agentActions']
}): Questionnaire | undefined {
  const action = item.agentActions?.find(
    (entry) => entry.type === 'QUESTIONNAIRE' || entry.tool === 'ask_user',
  )
  if (action?.data) {
    return normalizeQuestionnaire(action.data, action.summary || action.data.question)
  }
  return undefined
}

function parseStreamEvent(data: string): StreamEvent | null {
  try {
    return JSON.parse(data) as StreamEvent
  } catch {
    return data.trim() ? { event: 'delta', content: data } : null
  }
}

function pickStreamText(payload: StreamEvent): string {
  return (
    payload.content
    || payload.text
    || payload.message
    || payload.arguments?.question
    || payload.arguments?.content
    || payload.arguments?.text
    || payload.delta?.content
    || payload.choices?.[0]?.delta?.content
    || ''
  )
}

function isBalanceError(errorMessage: string) {
  return /余额|充值|insufficient/i.test(errorMessage)
}

type TypewriterHandle = {
  cancel: () => void
  done: Promise<void>
}

const typewriterHandles = new Map<string, TypewriterHandle>()
const streamingMessageIds = ref<Set<string>>(new Set())

function cancelTypewriter(messageId: string) {
  const handle = typewriterHandles.get(messageId)
  if (!handle) return
  handle.cancel()
  typewriterHandles.delete(messageId)
  const next = new Set(streamingMessageIds.value)
  next.delete(messageId)
  streamingMessageIds.value = next
}

/** 将整段文本以打字机效果流式写入助手消息 */
function streamAssistantText(
  assistant: { id: string; text: string; tip?: string },
  fullText: string,
  mode: 'replace' | 'append' = 'replace',
) {
  if (!fullText) return Promise.resolve()

  cancelTypewriter(assistant.id)

  let base = ''
  let target = fullText

  if (mode === 'append') {
    base = assistant.text
    if (fullText.startsWith(base)) {
      target = fullText
    } else {
      target = base + fullText
    }
  } else if (fullText === assistant.text) {
    assistant.tip = undefined
    return Promise.resolve()
  } else if (fullText.startsWith(assistant.text) && assistant.text) {
    base = assistant.text
    target = fullText
  } else {
    assistant.text = ''
    base = ''
    target = fullText
  }

  assistant.tip = undefined

  let cancelled = false
  let index = base.length
  streamingMessageIds.value = new Set(streamingMessageIds.value).add(assistant.id)

  const done = new Promise<void>((resolve) => {
    const step = () => {
      if (cancelled) {
        resolve()
        return
      }
      if (index >= target.length) {
        assistant.text = target
        typewriterHandles.delete(assistant.id)
        const next = new Set(streamingMessageIds.value)
        next.delete(assistant.id)
        streamingMessageIds.value = next
        scrollMessagesToBottom()
        resolve()
        return
      }
      const stride = target.length - index > 80 ? 3 : target.length - index > 30 ? 2 : 1
      index = Math.min(target.length, index + stride)
      assistant.text = target.slice(0, index)
      scrollMessagesToBottom()
      window.setTimeout(step, 16)
    }
    step()
  })

  typewriterHandles.set(assistant.id, {
    cancel: () => {
      cancelled = true
      assistant.text = target
    },
    done,
  })

  return done
}

function startChatStream(session: ChatSession, text: string, assetIds: string[] = []) {
  const chatId = session.chatId || props.currentSessionId
  if (!chatId) return

  // 绑定当前会话引用，流式过程中始终写回同一份 messages
  const targetSessionId = session.id
  const assistantId = `msg-${Date.now()}-assistant`
  session.messages.push({
    id: assistantId,
    role: 'assistant',
    text: '',
    kind: 'text',
    tip: '思考中...',
  })
  scrollMessagesToBottom()

  const resolveSession = () =>
    sessions.value.find(
      (item) => item.id === targetSessionId || item.chatId === chatId || item.id === chatId,
    ) ?? session

  const resolveAssistant = () => {
    const current = resolveSession()
    return current.messages.find((item) => item.id === assistantId)
  }

  const token = getToken()
  void connect({
    url: `${API_BASE}/chat-sessions/${chatId}/messages/stream`,
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: {
      model: resolveModel(autoMode.value),
      content: text,
      stream: true,
      ...(assetIds.length ? { attachmentAssetIds: assetIds } : {}),
    },
    onMessage(data) {
      const payload = parseStreamEvent(data)
      if (!payload) return

      const assistant = resolveAssistant()
      if (!assistant) return

      const eventName = payload.event || ''

      if (eventName === 'user_message') {
        return
      }

      if (eventName === 'agent_thinking') {
        if (assistant.text.trim() || streamingMessageIds.value.has(assistant.id)) {
          return
        }
        const iteration = payload.iteration
        assistant.tip = iteration
          ? `思考中...`
          : '思考中...'
        scrollMessagesToBottom()
        return
      }

      if (eventName === 'tool_result' || eventName === 'tool_res') {
        if (payload.success === false && payload.summary) {
          if (!assistant.text.trim() && !payload.summary.includes('工具不存在')) {
            void streamAssistantText(assistant, payload.summary, 'replace')
          }
        }
        return
      }

      if (eventName === 'tool_call' && payload.tool === 'ask_user') {
        const questionnaire = extractQuestionnaireFromStreamPayload(payload)
        if (questionnaire) {
          assistant.questionnaire = questionnaire
          void streamAssistantText(assistant, questionnaire.question, 'replace')
        }
        return
      }

      if (eventName === 'ai_message') {
        if (payload.id) {
          assistant.id = String(payload.id)
        }

        const questionnaire = extractQuestionnaireFromStreamPayload(payload)
        if (questionnaire) {
          assistant.questionnaire = questionnaire
          if (!assistant.text.trim()) {
            assistant.text = questionnaire.question
          }
        } else if (payload.content && !assistant.text.trim()) {
          assistant.text = payload.content
        }

        cancelTypewriter(assistant.id)
        assistant.tip = undefined
        scrollMessagesToBottom()
        return
      }

      const chunk = pickStreamText(payload)
      if (!chunk) return

      const isFullPiece =
        Boolean(payload.arguments?.question)
        || eventName === 'tool_call'
        || eventName === 'agent_thought'
        || eventName === 'assistant_message'

      if (isFullPiece) {
        void streamAssistantText(assistant, chunk, 'replace')
      } else {
        // delta / content 增量：直接追加
        cancelTypewriter(assistant.id)
        assistant.text += chunk
        assistant.tip = undefined
        scrollMessagesToBottom()
      }
    },
    onDone() {
      cancelTypewriter(assistantId)
      const assistant = resolveAssistant()
      if (assistant?.tip?.startsWith('思考中')) {
        assistant.tip = undefined
      }
      if (assistant && !assistant.text.trim() && !assistant.questionnaire) {
        assistant.text = '暂无回复，请稍后重试。'
      }
      scrollMessagesToBottom()
    },
    onError(err) {
      cancelTypewriter(assistantId)
      const assistant = resolveAssistant()
      if (!assistant) return

      const errorMessage = err instanceof Error ? err.message : '未知错误'

      if (isBalanceError(errorMessage)) {
        assistant.kind = 'balance_error'
        assistant.text = ''
        assistant.tip = undefined
      } else if (!assistant.text.trim()) {
        assistant.text = '请求失败，请稍后重试。'
        assistant.tip = errorMessage
      } else {
        assistant.tip = errorMessage
      }

      scrollMessagesToBottom()
    },
  })
}

async function ensureChatSession(session: ChatSession, title: string) {
  // 已有服务端会话 ID：同步到本地后直接复用
  const existingId = session.chatId || props.currentSessionId
  if (existingId) {
    session.chatId = existingId
    if (session.id !== existingId) {
      const oldId = session.id
      session.id = existingId
      if (activeSessionId.value === oldId) {
        activeSessionId.value = existingId
      }
    }
    return existingId
  }

  const created = await api.createChatSession({
    projectId: props.projectId,
    title,
  })
  const oldId = session.id
  session.chatId = created.id
  session.id = created.id
  session.title = created.title || title
  session.updatedAt = Date.now()
  if (activeSessionId.value === oldId) {
    activeSessionId.value = created.id
  }
  emit('set-current-session-id', created.id)
  emit('load-history-sessions')
  return created.id
}

function sendMessage() {
  if (isStreaming.value || isProcessing.value || isSending.value || !canSend.value) return

  const session = ensureActiveSession()
  const text = buildMessageText()
  const payloadAttachments = attachments.value.map((item) => ({ ...item }))
  if (!text && !payloadAttachments.length) return

  // 对话框中存在媒体资源时，收集其 assetId（画布附件 + @素材引用），随消息一起发送
  const assetIds = Array.from(
    new Set(
      [
        ...payloadAttachments.map((item) => item.assetId),
        ...assetMentions.value.map((item) => item.id),
      ].filter((id): id is string => Boolean(id)),
    ),
  )

  void onSendMessage(session, payloadAttachments, text, assetIds)
}

async function onSendMessage(
  session: ChatSession,
  payloadAttachments: ChatAttachment[],
  text: string,
  assetIds: string[] = [],
) {
  const title = session.title === '新建对话'
    ? (text || payloadAttachments[0]?.fileName || '新建对话')
    : session.title

  isSending.value = true
  try {
    await ensureChatSession(session, title)

    // 作废进行中的历史消息拉取，防止回写覆盖本地对话
    const chatId = session.chatId || session.id
    if (chatId) {
      messageLoadSeqByChatId.set(chatId, (messageLoadSeqByChatId.get(chatId) ?? 0) + 1)
    }

    if (session.title === '新建对话') {
      session.title = title
    }

    session.messages.push({
      id: `msg-${Date.now()}`,
      role: 'user',
      text,
      kind: 'text',
      attachments: payloadAttachments,
      tip: CHAT_TIPS[session.messages.length % CHAT_TIPS.length],
    })
    session.updatedAt = Date.now()

    message.value = ''
    clearAttachments()
    clearAssetMentions()
    clearSelectedSkill()
    saveActiveDraft()
    scrollMessagesToBottom()
    if (text) {
      emit('send', { text, attachments: payloadAttachments })
      startChatStream(session, text, assetIds)
    }
  } catch {
    // ensureChatSession 失败时由请求层提示
  } finally {
    isSending.value = false
  }
}

async function copyMessage(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // ignore clipboard failures
  }
}

function onQuestionnaireSelect(message: ChatMessage, option: QuestionnaireOption) {
  if (isStreaming.value || isProcessing.value || isSending.value || message.questionnaireAnswered) return

  message.questionnaireAnswered = true
  const session = ensureActiveSession()
  void onSendMessage(session, [], option.label, [])
}

function stopProcessing() {
  close()
  isProcessing.value = false
  typewriterHandles.forEach((handle) => handle.cancel())
  typewriterHandles.clear()
  streamingMessageIds.value = new Set()
}

function beginProcessing() {
  isProcessing.value = true
}

function endProcessing() {
  isProcessing.value = false
}

function startNewChat() {
  close()
  isProcessing.value = false
  saveActiveDraft()
  clearSelectedSkill()
  closeModelMenu()
  closeSkillMenu()

  const existingEmpty = sessions.value.find(
    (item) => item.isOpen && item.title === '新建对话' && !item.messages.length && !item.chatId,
  )
  if (existingEmpty) {
    activeSessionId.value = existingEmpty.id
    loadSessionDraft(existingEmpty)
    emit('set-current-session-id', '')
    emit('set-session-name', '新建对话')
    emit('new-chat')
    focusInput()
    return
  }

  const session = createSession('新建对话', true)
  sessions.value.push(session)
  activeSessionId.value = session.id
  message.value = ''
  clearAttachments()
  clearAssetMentions()
  emit('set-current-session-id', '')
  emit('set-session-name', '新建对话')
  emit('new-chat')
  focusInput()
}

function focusInput() {
  collapsed.value = false
  nextTick(() => inputRef.value?.focus())
}

function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.chat-panel__auto-wrap')) {
    showAutoMenu.value = false
  }
  if (!target?.closest('.chat-panel__history-wrap')) {
    showHistoryMenu.value = false
  }
  if (!target?.closest('.chat-panel__model-wrap')) {
    closeModelMenu()
  }
  if (!target?.closest('.chat-panel__skill-picker') && !target?.closest('.chat-panel__skill-wrap')) {
    if (!detectSlashQuery(message.value) && message.value !== '/') {
      closeSkillMenu()
    }
  }
}

onMounted(() => {
  const initial = createSession('新建对话', true)
  sessions.value = [initial]
  activeSessionId.value = initial.id
  document.addEventListener('mousedown', onDocumentMouseDown, true)
})

watch(
  () => [props.historySessions, props.currentSessionId] as const,
  ([list, sessionId]) => {
    if (!list?.length || !sessionId) return

    // 历史列表尚未包含该 id 时不要回退到第一条，否则会把正在对话的 tab 切走
    const target = list.find((item) => item.id === sessionId)
    if (!target?.id) return

    const existing = sessions.value.find(
      (item) => item.id === target.id || item.chatId === target.id,
    )
    if (existing?.isOpen) {
      if (activeSessionId.value !== existing.id) {
        // 仅在当前会话没有进行中的本地消息时才切换
        const active = activeSession.value
        const activeBusy =
          !!active
          && (active.messages.length > 0 || isStreaming.value || isSending.value)
          && active.id !== existing.id
          && active.chatId !== existing.chatId
        if (activeBusy) return

        activeSessionId.value = existing.id
        loadSessionDraft(existing)
      }
      return
    }

    const active = activeSession.value
    const isEmptyPlaceholder =
      !!active
      && active.title === '新建对话'
      && !active.messages.length
      && !active.chatId

    // 正在发送/流式中：不要用历史 tab 覆盖当前会话
    if (isStreaming.value || isSending.value || (active && active.messages.length > 0 && !isEmptyPlaceholder)) {
      // 若当前会话已绑定同一 chatId，只做 id 对齐
      if (active && (active.chatId === target.id || active.id === target.id)) {
        openSessionTab(target, { asDefault: false })
      }
      return
    }

    openSessionTab(target, { asDefault: isEmptyPlaceholder })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
  close()
  typewriterHandles.forEach((handle) => handle.cancel())
  typewriterHandles.clear()
  streamingMessageIds.value = new Set()
  sessions.value.forEach((session) => {
    session.draft.attachments.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    })
  })
  clearAttachments()
})

defineExpose({
  beginProcessing,
  endProcessing,
  focusInput,
  startNewChat,
  addAttachmentFromCanvas,
  addSkillFile,
  insertAssetMention,
})
</script>

<style scoped lang="scss">
.chat-panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: 380px;
  height: 100vh;
  height: 100dvh;
  border-left: 1px solid #e5e5e5;
  background: #fff;
  box-shadow: -8px 0 24px rgba(15, 23, 42, 0.06);
  transition: width 0.2s ease;

  &--collapsed {
    width: 0px !important;
  }
}

.chat-panel__header {
  display: flex;
  align-items: stretch;
  gap: 8px;
  flex-shrink: 0;
  min-height: 48px;
  padding: 8px 10px 0;
  border-bottom: 1px solid #e5e5e5;
  background: #f3f4f6;
}

.chat-panel__tabs {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.chat-panel__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 120px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    color: #374151;
  }

  &--active {
    border-color: #e5e5e5;
    background: #fff;
    color: #111827;
    font-weight: 500;
  }
}

.chat-panel__tab-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.chat-panel__tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: #f3f4f6;
    color: #374151;
  }
}

.chat-panel__header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding-bottom: 8px;
}

.chat-panel__history-wrap {
  position: relative;
}

.chat-panel__history-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 5;
  width: 280px;
  padding: 10px;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
}

.chat-panel__history-search {
  width: 100%;
  padding: 8px 12px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  color: #111827;
  font: inherit;
  font-size: 13px;
  outline: none;

  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    border-color: #d1d5db;
    background: #fff;
  }
}

.chat-panel__history-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  max-height: 240px;
  overflow: auto;
}

.chat-panel__history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: #f3f4f6;
  }
}

.chat-panel__history-name {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.chat-panel__history-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.chat-panel__history-badge {
  padding: 2px 6px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
}

.chat-panel__history-time {
  color: #9ca3af;
  font-size: 12px;
}

.chat-panel__history-empty {
  padding: 16px 8px;
  color: #9ca3af;
  font-size: 13px;
  text-align: center;
}

.chat-panel__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: #e5e7eb;
  }

  &--sm {
    width: 28px;
    height: 28px;
  }
}

.chat-panel__icon {
  display: block;
  width: 16px;
  height: 16px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;

  &--plus {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23374151' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M8 3v10M3 8h10'/%3E%3C/svg%3E");
  }

  &--history {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23374151' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z'/%3E%3Cpath d='M8 5.5V8l1.5 1.5'/%3E%3C/svg%3E");
  }

  &--expand {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23374151' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 4h6v6M10 8H4'/%3E%3C/svg%3E");
  }
}

.chat-panel__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.chat-panel__welcome {
  flex: 1;
  min-height: 0;
  padding: 28px 20px 16px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.chat-panel__greeting {
  margin: 0 0 8px;
  color: #111827;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
}

.chat-panel__sub-greeting {
  margin: 0 0 20px;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.4;
}

.chat-panel__skills {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.chat-panel__skill-btn {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }
}

.chat-panel__hint {
  margin: 16px 0 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
}

.chat-panel__messages {
  flex: 1;
  min-height: 0;
  padding: 20px 18px 12px;
  overflow: auto;
}

.chat-panel__message {
  margin-bottom: 18px;

  &--user {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  &--assistant,
  &--system {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
}

.chat-panel__message-bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 14px;
  background: #f3f4f6;
}

.chat-panel__message-text {
  margin: 0;
  color: #111827;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.chat-panel__questionnaire {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 85%;
  margin-top: 10px;
}

.chat-panel__questionnaire-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #111827;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.chat-panel__questionnaire-option-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
}

.chat-panel__questionnaire-option-desc {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.45;
}

.chat-panel__stream-caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 1px;
  vertical-align: -2px;
  background: currentColor;
  animation: chat-panel-caret-blink 1s steps(1) infinite;
}

@keyframes chat-panel-caret-blink {
  0%,
  50% {
    opacity: 1;
  }
  50.01%,
  100% {
    opacity: 0;
  }
}

.chat-panel__message-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.chat-panel__message-thumb {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.chat-panel__copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-top: 6px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.chat-panel__copy-icon {
  display: block;
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' fill='none' stroke='%239ca3af' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='4.5' y='4.5' width='7' height='7' rx='1.2'/%3E%3Cpath d='M3.5 9.5h-.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v.5'/%3E%3C/svg%3E") center / contain no-repeat;
}

.chat-panel__message-tip {
  margin: 10px 0 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.5;
}

.chat-panel__balance-card {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #fecaca;
  border-radius: 12px;
  background: #fff;
}

.chat-panel__balance-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-panel__balance-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: #ef4444;
  flex-shrink: 0;
}

.chat-panel__balance-title {
  color: #ef4444;
  font-size: 14px;
  font-weight: 600;
}

.chat-panel__balance-caret {
  width: 10px;
  height: 10px;
  margin-left: auto;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10' fill='none' stroke='%23ef4444' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 3.5 5 6l2.5-2.5'/%3E%3C/svg%3E") center / contain no-repeat;
}

.chat-panel__balance-desc {
  margin: 8px 0 10px;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
}

.chat-panel__balance-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }
}

.chat-panel__balance-link-icon {
  width: 12px;
  height: 12px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%236b7280' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4.5 2.5H9.5V7.5'/%3E%3Cpath d='M2.5 9.5 9.5 2.5'/%3E%3C/svg%3E") center / contain no-repeat;
}

.chat-panel__composer {
  flex-shrink: 0;
  padding: 0 16px 16px;
}

.chat-panel__asset-mentions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 16px 0;
}

.chat-panel__asset-mention {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 8px;
  background: #f3f4f6;
  color: #111827;
  font-size: 13px;
  line-height: 1.3;
}

.chat-panel__asset-mention-at {
  color: #6b7280;
}

.chat-panel__asset-mention-role {
  padding: 1px 6px;
  border-radius: 999px;
  background: #e5e7eb;
  color: #4b5563;
  font-size: 12px;
}

.chat-panel__asset-mention-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-panel__asset-mention-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #e5e7eb;
    color: #374151;
  }
}

.chat-panel__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 16px 8px 16px;
}

.chat-panel__attachment {
  position: relative;
  width: 48px;
  height: 48px;
}

.chat-panel__attachment-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.chat-panel__attachment-uploading {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: rgb(17 24 39 / 45%);
  animation: chat-panel-attachment-pulse 1.2s ease-in-out infinite;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 14px;
    height: 14px;
    margin: -7px 0 0 -7px;
    border: 2px solid rgb(255 255 255 / 35%);
    border-top-color: #fff;
    border-radius: 50%;
    animation: chat-panel-attachment-spin 0.8s linear infinite;
  }
}

.chat-panel__attachment-error {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: rgb(220 38 38 / 55%);

  &::after {
    content: '!';
    position: absolute;
    top: 50%;
    left: 50%;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    transform: translate(-50%, -50%);
  }
}

@keyframes chat-panel-attachment-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.72;
  }
}

@keyframes chat-panel-attachment-spin {
  to {
    transform: rotate(360deg);
  }
}

.chat-panel__attachment-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #111827;
  color: #fff;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}

.chat-panel__file-input {
  display: none;
}

.panel__composer_box {
  border: 1px solid #e5e5e5;
  border-radius: 14px;
}

.chat-panel__input {
  display: block;
  width: 100%;
  min-height: 96px;
  padding: 14px 16px;
  box-sizing: border-box;
  border: none;
  border-radius: 14px;
  background: #fff;
  color: #111827;
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;

  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    outline: none;
  }
}

.chat-panel__composer-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 10px 12px;
}

.chat-panel__composer-divider {
  width: 1px;
  height: 14px;
  background: #e5e7eb;
  flex-shrink: 0;
}

.chat-panel__meta-btn {
  padding: 0;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    color: #111827;
  }

  &--active {
    color: #111827;
    background: #f3f4f6;
    border-radius: 6px;
    padding: 2px 6px;
  }
}

.chat-panel__model-wrap,
.chat-panel__skill-wrap {
  position: relative;
}

.chat-panel__model-picker {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 12;
  width: 280px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
}

.chat-panel__model-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.chat-panel__model-picker-title {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.chat-panel__model-picker-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
}

.chat-panel__model-picker-switch {
  width: 28px;
  height: 16px;
  accent-color: #111827;
  cursor: pointer;
}

.chat-panel__model-picker-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
  padding: 3px;
  border-radius: 8px;
  background: #f3f4f6;
}

.chat-panel__model-picker-tab {
  flex: 1;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;

  &--active {
    background: #fff;
    color: #111827;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  }
}

.chat-panel__model-picker-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow: auto;
}

.chat-panel__model-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.chat-panel__model-picker-icon {
  display: block;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  background: #111827;
  border-radius: 4px;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;

  &[data-icon='image'] {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='currentColor'%3E%3Cpath d='M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5z'/%3E%3C/svg%3E");
  }

  &[data-icon='video'] {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='currentColor'%3E%3Cpath d='M2 4.5A1.5 1.5 0 0 1 3.5 3h5l2 2h3.5A1.5 1.5 0 0 1 14 6.5v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 10.5z'/%3E%3C/svg%3E");
  }

  &[data-icon='audio'] {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='currentColor'%3E%3Cpath d='M8 2a3 3 0 0 0-3 3v4.17A2.5 2.5 0 0 0 6.5 13 2.5 2.5 0 0 0 9 10.5V5a1 1 0 1 1 2 0v5.5a4.5 4.5 0 0 1-4 4.47V14h2a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h1v-1.03A6.5 6.5 0 0 1 13 10.5V5a3 3 0 0 0-6 0z'/%3E%3C/svg%3E");
  }
}

.chat-panel__model-picker-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.chat-panel__model-picker-name {
  color: #111827;
  font-size: 13px;
  font-weight: 500;
}

.chat-panel__model-picker-sub {
  color: #9ca3af;
  font-size: 11px;
}

.chat-panel__model-picker-check {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' fill='none' stroke='%23111827' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 7.2 5.8 10 11 4'/%3E%3C/svg%3E") center / contain no-repeat;
}

.chat-panel__model-picker-empty {
  padding: 12px 8px;
  color: #9ca3af;
  font-size: 12px;
  text-align: center;
}

.chat-panel__skill-picker {
  margin: 0 10px 8px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.1);
}

.chat-panel__skill-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.chat-panel__skill-picker-title {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.chat-panel__skill-picker-create {
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    color: #111827;
  }
}

.chat-panel__skill-picker-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 240px;
  overflow: auto;
}

.chat-panel__skill-picker-item {
  display: grid;
  grid-template-columns: auto auto;
  grid-template-rows: auto auto;
  gap: 2px 8px;
  padding: 10px 8px;
  border-radius: 10px;
  cursor: pointer;

  &:hover,
  &--hover {
    background: #f3f4f6;
  }
}

.chat-panel__skill-picker-name {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.chat-panel__skill-picker-cmd {
  color: #9ca3af;
  font-size: 12px;
}

.chat-panel__skill-picker-desc {
  grid-column: 1 / -1;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.4;
}

.chat-panel__skill-picker-empty {
  padding: 12px 8px;
  color: #9ca3af;
  font-size: 12px;
  text-align: center;
}

.chat-panel__skill-picker-foot {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #f3f4f6;
}

.chat-panel__skill-picker-foot-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 12px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.chat-panel__skill-picker-foot-icon {
  display: block;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  background: #6b7280;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;

  &[data-icon='plus'] {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' fill='currentColor'%3E%3Cpath d='M7 2.5v9M2.5 7h9' stroke='currentColor' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
  }

  &[data-icon='settings'] {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' fill='currentColor'%3E%3Cpath d='M2 10.5h10M2 7h10M2 3.5h10' stroke='currentColor' stroke-width='1.3' stroke-linecap='round'/%3E%3C/svg%3E");
  }
}

.chat-panel__skill-picker-foot-chevron {
  margin-left: auto;
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 2.5 6.5 5 3.5 7.5'/%3E%3C/svg%3E") center / contain no-repeat;
}

.chat-panel__skill-tooltip {
  position: fixed;
  z-index: 100;
  max-width: 280px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #111827;
  color: #f9fafb;
  font-size: 12px;
  line-height: 1.55;
  pointer-events: none;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.24);
}

.chat-panel__skill-chip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 0;
}

.chat-panel__skill-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &--selected {
    border-color: #ef4444;
    box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.35);
  }
}

.chat-panel__skill-tab-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 20px;
  padding: 0 6px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #9ca3af;
  font-size: 11px;
}

.chat-panel__auto-wrap {
  position: relative;
  margin-left: auto;
}

.chat-panel__auto-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #374151;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.chat-panel__caret {
  display: inline-block;
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10' fill='none' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 3.5 5 6l2.5-2.5'/%3E%3C/svg%3E") center / contain no-repeat;
}

.chat-panel__auto-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 2;
  min-width: 120px;
  padding: 6px;
  border: 1px solid #e5e5e5;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
}

.chat-panel__auto-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #374151;
  font-size: 12px;
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    background: #f3f4f6;
    color: #111827;
  }
}

.chat-panel__send,
.chat-panel__stop {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.chat-panel__send {
  background: #374151;

  &:hover:not(:disabled) {
    background: #111827;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.chat-panel__stop {
  background: #111827;

  &:hover {
    background: #374151;
  }
}

.chat-panel__send-icon {
  display: block;
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' fill='none' stroke='%23ffffff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 11V3M7 3 3.5 6.5M7 3l3.5 3.5'/%3E%3C/svg%3E") center / contain no-repeat;
}

.chat-panel__stop-icon {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: #fff;
}

.chat-panel__expand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }
}

.chat-panel__msg-icon {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 120;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  overflow: visible;

  &--light {
    border: 1px solid #ffffff;
    background: #ffffff;
  }
}

.chat-panel__msg-icon-logo {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: contain;
  pointer-events: none;
  animation: chat-panel-msg-icon-logo-glow 2.8s ease-in-out infinite;
}

@keyframes chat-panel-msg-icon-logo-glow {
  0%,
  100% {
    filter:
      drop-shadow(0 0 3px rgba(124, 58, 237, 0.42))
      drop-shadow(0 0 8px rgba(124, 58, 237, 0.24));
  }

  50% {
    filter:
      drop-shadow(0 0 6px rgba(124, 58, 237, 0.58))
      drop-shadow(0 0 14px rgba(124, 58, 237, 0.34));
  }
}

/* Dark theme overrides */
.chat-panel--dark {
  border-left-color: #2e2e34;
  background: #1a1a1e;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.35);

  .chat-panel__header {
    border-bottom-color: #2e2e34;
    background: #141418;
  }

  .chat-panel__tab {
    color: #9ca3af;

    &:hover {
      color: #d1d5db;
    }

    &--active {
      border-color: #2e2e34;
      background: #1a1a1e;
      color: #f3f4f6;
    }
  }

  .chat-panel__tab-close:hover {
    background: #2a2a30;
    color: #e5e7eb;
  }

  .chat-panel__icon-btn {
    color: #d1d5db;

    &:hover {
      background: #2a2a30;
    }
  }

  .chat-panel__history-menu {
    border-color: #2e2e34;
    background: #1e1e22;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  }

  .chat-panel__history-search {
    border-color: #3d3d45;
    background: #252528;
    color: #f3f4f6;

    &:focus {
      border-color: #4b4b55;
      background: #1a1a1e;
    }
  }

  .chat-panel__history-item:hover {
    background: #2a2a30;
  }

  .chat-panel__history-name {
    color: #e5e7eb;
  }

  .chat-panel__history-badge {
    background: #2a2a30;
    color: #9ca3af;
  }

  .chat-panel__icon {
    &--plus {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23d1d5db' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M8 3v10M3 8h10'/%3E%3C/svg%3E");
    }

    &--history {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23d1d5db' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z'/%3E%3Cpath d='M8 5.5V8l1.5 1.5'/%3E%3C/svg%3E");
    }

    &--expand {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23d1d5db' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 4h6v6M10 8H4'/%3E%3C/svg%3E");
    }
  }

  .chat-panel__greeting {
    color: #f3f4f6;
  }

  .chat-panel__sub-greeting {
    color: #9ca3af;
  }

  .chat-panel__skill-btn {
    border-color: #3d3d45;
    background: #252528;
    color: #e5e7eb;

    &:hover {
      border-color: #4b4b55;
      background: #2a2a30;
    }
  }

  .chat-panel__hint {
    color: #6b7280;
  }

  .chat-panel__message-bubble {
    background: #2a2a30;
  }

  .chat-panel__message-text {
    color: #e5e7eb;
  }

  .chat-panel__questionnaire-option {
    border-color: #3d3d45;
    background: #252528;
    color: #e5e7eb;

    &:hover:not(:disabled) {
      border-color: #4b4b55;
      background: #2a2a30;
    }
  }

  .chat-panel__questionnaire-option-desc {
    color: #9ca3af;
  }

  .chat-panel__message-tip {
    color: #6b7280;
  }

  .chat-panel__balance-card {
    border-color: #7f1d1d;
    background: #1e1e22;
  }

  .chat-panel__balance-desc {
    color: #9ca3af;
  }

  .chat-panel__balance-action {
    border-color: #3d3d45;
    background: #252528;
    color: #e5e7eb;
  }

  .chat-panel__composer {
    .panel__composer_box {
      border-color: #2e2e34;
    }
  }

  .chat-panel__input {
    background: #1a1a1e;
    color: #f3f4f6;

    &::placeholder {
      color: #6b7280;
    }
  }

  .chat-panel__composer-divider {
    background: #3d3d45;
  }

  .chat-panel__meta-btn {
    color: #9ca3af;

    &:hover {
      color: #f3f4f6;
    }
  }

  .chat-panel__auto-btn {
    color: #d1d5db;

    &:hover {
      background: #2a2a30;
    }
  }

  .chat-panel__caret {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10' fill='none' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 3.5 5 6l2.5-2.5'/%3E%3C/svg%3E");
  }

  .chat-panel__auto-menu {
    border-color: #2e2e34;
    background: #1e1e22;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }

  .chat-panel__auto-item {
    color: #e5e7eb;

    &:hover,
    &--active {
      background: #2a2a30;
      color: #f3f4f6;
    }
  }

  .chat-panel__send {
    background: #4b5563;

    &:hover:not(:disabled) {
      background: #6b7280;
    }
  }

  .chat-panel__stop {
    background: #374151;

    &:hover {
      background: #4b5563;
    }
  }

  .chat-panel__expand {
    &:hover {
      background: #2a2a30;
    }
  }
}
</style>
