<template>
  <aside
    class="chat-panel"
    :class="{
      'chat-panel--collapsed': collapsed,
      'chat-panel--active': isActive,
      'chat-panel--dark': isDarkTheme,
    }"
    aria-label="对话面板"
  >
    <ChatPanelHeader
      :open-tabs="openTabs"
      :active-session-id="activeSessionId"
      :history-sessions="historySessions"
      :current-session-id="currentSessionId"
      v-model:history-search="historySearch"
      v-model:show-history-menu="showHistoryMenu"
      @switch-session="switchSession"
      @close-tab="closeTab"
      @new-chat="startNewChat"
      @toggle-history="toggleHistoryMenu"
      @open-history="openFromHistory"
      @close-chat="emit('close-chat')"
    />

    <div v-show="!collapsed" class="chat-panel__body">
      <ChatWelcome v-if="!isActive" :skills="skills" @select-skill="selectWelcomeSkill" />

      <ChatMessageList
        v-else
        ref="messageListRef"
        :messages="messages"
        :streaming-message-ids="streamingMessageIds"
        :is-streaming="isStreaming"
        :is-sending="isSending"
        :is-processing="isProcessing"
        @pick-option="onQuestionnaireOptionPick"
        @custom-input="onQuestionnaireCustomInput"
        @prev="onQuestionnairePrev"
        @next="onQuestionnaireNext"
      />

      <ChatComposer
        ref="composerRef"
        :show-skill-menu="showSkillMenu"
        :filtered-chat-skills="filteredChatSkills as any"
        :hovered-skill="hoveredSkill as any"
        :skill-tooltip-text="skillTooltipText"
        :skill-tooltip-style="skillTooltipStyle"
        :selected-skill="selectedSkill as any"
        :skill-chip-selected="skillChipSelected"
        :asset-mentions="assetMentions"
        :attachments="attachments"
        :message="message"
        :input-placeholder="inputPlaceholder"
        :show-model-menu="showModelMenu"
        :model-button-label="modelButtonLabel"
        :is-all-models-selected-in-tab="isAllModelsSelectedInTab"
        :model-category-tabs="modelCategoryTabs"
        :active-model-category="activeModelCategory"
        :models-in-active-category="modelsInActiveCategory"
        :selected-model-keys="selectedModelKeys"
        :is-streaming="isStreaming"
        :is-sending="isSending"
        :is-processing="isProcessing"
        :can-send="canSend"
        @composer-drop="onComposerDrop"
        @skill-item-enter="(event, skill) => onSkillItemEnter(event, skill as any)"
        @skill-item-leave="onSkillItemLeave"
        @select-skill="(skill) => selectChatSkill(skill as any)"
        @select-skill-chip="selectSkillChip"
        @remove-asset-mention="removeAssetMention"
        @remove-attachment="removeAttachment"
        @update:message="message = $event"
        @message-input="onMessageInput"
        @composer-keydown="onComposerKeydown"
        @file-input-change="onFileInputChange"
        @open-file-picker="openComposerFilePicker"
        @toggle-model-menu="toggleModelMenu"
        @toggle-select-all-models="toggleSelectAllModelsInTab"
        @update:active-model-category="activeModelCategory = $event as any"
        @toggle-model-selection="toggleModelSelection"
        @toggle-skill-menu="toggleSkillMenu"
        @stop="stopProcessing"
        @send="sendMessage"
      />
    </div>

    <ChatCollapsedFab :collapsed="collapsed" @expand="onTargetCollapse" />
  </aside>

  <ChatFloatingLogo
    :collapsed="collapsed"
    :is-light-theme="isLightTheme"
    :logo-src="logoSrc"
    @expand="onTargetCollapse"
  />
</template>

<script setup lang="ts">
import { computed, isRef, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import logoWhite from '@assets/images/logo_white.png'
import logoBlack from '@assets/images/logo_black.png'
import { useCanvasBgTheme } from '@/components/Canvas/useCanvasBgTheme'
import type { ChatTools } from '@/components/Canvas/constants'
import type {
  ChatAttachment,
  ChatSendPayload,
  ChatSession,
  ChatTaskCreatedPayload,
} from './chatTypes'
import { useSSE } from '@/hooks/useSSE'
import { useChatTypewriter } from './chat/useChatTypewriter'
import { useChatModels } from './chat/useChatModels'
import { useChatSkills } from './chat/useChatSkills'
import { detectSlashQuery } from './chat/useChatSkills'
import { useChatAttachments } from './chat/useChatAttachments'
import { useChatSessions } from './chat/useChatSessions'
import { useChatStream } from './chat/useChatStream'
import { isChatAttachmentSendReady } from './chat/chatAttachmentValidate'
import ChatPanelHeader from './chat/components/ChatPanelHeader.vue'
import ChatWelcome from './chat/components/ChatWelcome.vue'
import ChatMessageList from './chat/components/ChatMessageList.vue'
import ChatComposer from './chat/components/ChatComposer.vue'
import ChatCollapsedFab from './chat/components/ChatCollapsedFab.vue'
import ChatFloatingLogo from './chat/components/ChatFloatingLogo.vue'

const props = defineProps<{
  projectId?: string
  historySessions?: any[]
  currentSessionId?: string
  sessionName?: string
  chatTools?: any[]
  aiSkills?: any[]
}>()

const emit = defineEmits<{
  send: [payload: ChatSendPayload]
  'set-current-session-id': [sessionId: string]
  'load-history-sessions': []
  'new-chat': []
  'set-session-name': [name: string]
  'close-chat': []
  'task-created': [payload: ChatTaskCreatedPayload]
  'task-updated': [payload: { taskId: string | number; taskName: string }]
  'insert-image-to-canvas': [
    payload: {
      attachmentId: string
      assetId?: string
      previewUrl: string
      fileName?: string
      width?: number | null
      height?: number | null
    },
  ]
}>()

const collapsed = defineModel<boolean>('collapsed', { required: true })

const { loading, connected, connect, close } = useSSE()
const isStreaming = computed(() => loading.value || connected.value)

const { isLightTheme } = useCanvasBgTheme()
const isDarkTheme = computed(() => !isLightTheme.value)
const logoSrc = computed(() => (isLightTheme.value ? logoBlack : logoWhite))

const messageListRef = ref<{ el: HTMLElement | null } | null>(null)
const composerRef = ref<{
  inputRef: Ref<HTMLTextAreaElement | null> | HTMLTextAreaElement | null
  fileInputRef: Ref<HTMLInputElement | null> | HTMLInputElement | null
} | null>(null)

function scrollMessagesToBottom() {
  nextTick(() => {
    const el = messageListRef.value?.el
    if (!el) return
    el.scrollTop = el.scrollHeight
  })
}

const autoMode = ref('Auto')

// 延迟绑定的跨 composable 回调，避免循环依赖
const bridge = {
  ensureActiveSession: (() => {
    throw new Error('ensureActiveSession not ready')
  }) as () => ChatSession,
  saveActiveDraft: () => {},
  focusInput: () => {},
  closeModelMenu: () => {},
  closeSkillMenu: () => {},
  clearSelectedSkill: () => {},
  message: null as Ref<string> | null,
  showAutoMenu: null as Ref<boolean> | null,
}

const {
  streamingMessageIds,
  cancelTypewriter,
  streamAssistantText,
  cancelAll: cancelAllTypewriters,
  dispose: disposeTypewriters,
} = useChatTypewriter(scrollMessagesToBottom)

const {
  attachments,
  assetMentions,
  bindAttachmentNodeId,
  clearAssetMentions,
  removeAssetMention,
  insertAssetMention,
  addAttachmentFromCanvas,
  addSkillFile,
  removeAttachment,
  clearAttachments,
  invalidateAttachmentFetches,
  cancelSessionAttachments,
  onFileInputChange,
  onComposerDrop,
} = useChatAttachments({
  projectId: () => props.projectId,
  emitInsertImageToCanvas: (payload) => emit('insert-image-to-canvas', payload),
  ensureActiveSession: () => bridge.ensureActiveSession(),
  getActiveSessionId: () => activeSessionId.value,
  getSessionAttachments: (sessionId) =>
    sessions.value.find((session) => session.id === sessionId)?.draft.attachments,
  focusInput: () => bridge.focusInput(),
  saveActiveDraft: () => bridge.saveActiveDraft(),
  getMessage: () => bridge.message?.value ?? '',
  setMessage: (next) => {
    if (bridge.message) bridge.message.value = next
  },
})

const {
  sessions,
  activeSessionId,
  message,
  historySearch,
  showHistoryMenu,
  showAutoMenu,
  isSending,
  isProcessing,
  openTabs,
  activeSession,
  messages,
  isActive,
  messageLoadSeqByChatId,
  openSessionTab,
  saveActiveDraft,
  loadSessionDraft,
  ensureActiveSession,
  switchSession,
  openFromHistory,
  closeTab,
  toggleHistoryMenu,
  startNewChat,
  resetForProject: resetSessionsForProject,
  createSession,
} = useChatSessions({
  attachments,
  assetMentions,
  isStreaming,
  streamingMessageIds,
  scrollMessagesToBottom,
  focusInput: () => bridge.focusInput(),
  close,
  cancelAllTypewriters,
  clearAttachments,
  clearAssetMentions,
  cancelSessionAttachments,
  clearSelectedSkill: () => bridge.clearSelectedSkill(),
  closeModelMenu: () => bridge.closeModelMenu(),
  closeSkillMenu: () => bridge.closeSkillMenu(),
  emitSetCurrentSessionId: (sessionId) => emit('set-current-session-id', sessionId),
  emitSetSessionName: (name) => emit('set-session-name', name),
  emitNewChat: () => emit('new-chat'),
})

bridge.ensureActiveSession = ensureActiveSession
bridge.saveActiveDraft = saveActiveDraft
bridge.message = message
bridge.showAutoMenu = showAutoMenu

const {
  activeModelCategory,
  selectedModelKeys,
  showModelMenu,
  modelsInActiveCategory,
  modelButtonLabel,
  isAllModelsSelectedInTab,
  modelCategoryTabs,
  closeModelMenu,
  toggleModelMenu,
  toggleModelSelection,
  toggleSelectAllModelsInTab,
  resolveModel,
} = useChatModels({
  chatTools: () => (props.chatTools ?? {}) as ChatTools,
  showAutoMenu,
  closeSkillMenu: () => bridge.closeSkillMenu(),
})

bridge.closeModelMenu = closeModelMenu

const {
  skills,
  filteredChatSkills,
  showSkillMenu,
  selectedSkill,
  skillChipSelected,
  hoveredSkill,
  skillTooltipStyle,
  skillTooltipText,
  closeSkillMenu,
  toggleSkillMenu,
  selectChatSkill,
  selectWelcomeSkill,
  selectSkillChip,
  clearSelectedSkill,
  onSkillItemEnter,
  onSkillItemLeave,
  onMessageInput,
  getSelectedSkillDescription,
} = useChatSkills({
  aiSkills: () => props.aiSkills,
  message,
  ensureActiveSession,
  focusInput: () => bridge.focusInput(),
  closeModelMenu,
  showAutoMenu,
})

bridge.closeSkillMenu = closeSkillMenu
bridge.clearSelectedSkill = clearSelectedSkill

const inputPlaceholder = computed(() => {
  if (isActive.value) return '可继续输入，将排队发送...'
  const description = getSelectedSkillDescription()
  if (description) return description
  return '输入消息...'
})

const canSend = computed(() => {
  const hasContent = Boolean(
    message.value.trim() ||
    attachments.value.length ||
    assetMentions.value.length ||
    selectedSkill.value,
  )
  const attachmentsReady = attachments.value.every((item) => isChatAttachmentSendReady(item))
  return hasContent && attachmentsReady
})

const {
  sendMessage,
  onQuestionnaireOptionPick,
  onQuestionnaireCustomInput,
  onQuestionnairePrev,
  onQuestionnaireNext,
  stopProcessing,
  beginProcessing,
  endProcessing,
  invalidatePendingChatRequests,
} = useChatStream({
  projectId: () => props.projectId,
  currentSessionId: () => props.currentSessionId,
  sessions,
  activeSessionId,
  message,
  attachments,
  assetMentions,
  selectedSkill: selectedSkill as Ref<Record<string, any> | null>,
  autoMode,
  isStreaming,
  isSending,
  isProcessing,
  canSend,
  messageLoadSeqByChatId,
  streamingMessageIds,
  connect,
  close,
  resolveModel,
  ensureActiveSession,
  saveActiveDraft,
  clearAttachments,
  clearAssetMentions,
  clearSelectedSkill,
  scrollMessagesToBottom,
  cancelTypewriter,
  streamAssistantText,
  cancelAllTypewriters,
  emitSend: (payload) => emit('send', payload),
  emitSetCurrentSessionId: (sessionId) => emit('set-current-session-id', sessionId),
  emitLoadHistorySessions: () => emit('load-history-sessions'),
  emitTaskCreated: (payload) => emit('task-created', payload),
  emitTaskUpdated: (payload) => emit('task-updated', payload),
})

/** 切项目：先作废 in-flight 创建会话/SSE/画布附件拉取，再重置面板，避免迟到回调写入新画布 */
function resetForProject() {
  invalidatePendingChatRequests()
  invalidateAttachmentFetches()
  resetSessionsForProject()
}

function unwrapRef<T>(value: Ref<T> | T | null | undefined): T | null {
  if (value == null) return null
  return (isRef(value) ? value.value : value) as T
}

function focusInput() {
  collapsed.value = false
  nextTick(() => {
    unwrapRef(composerRef.value?.inputRef)?.focus()
  })
}

bridge.focusInput = focusInput

function openComposerFilePicker() {
  unwrapRef(composerRef.value?.fileInputRef)?.click()
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Backspace' || event.key === 'Delete') {
    if (selectedSkill.value && skillChipSelected.value) {
      event.preventDefault()
      clearSelectedSkill()
      return
    }

    const input = unwrapRef(composerRef.value?.inputRef)
    if (
      selectedSkill.value &&
      input &&
      input.selectionStart === 0 &&
      input.selectionEnd === 0 &&
      !message.value.trim()
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

function onTargetCollapse() {
  collapsed.value = false
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
  if (
    !target?.closest('.chat-panel__skill-picker') &&
    !target?.closest('.chat-panel__skill-wrap')
  ) {
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
  () => props.projectId,
  (nextId, prevId) => {
    if (!prevId || prevId === nextId) return
    resetForProject()
  },
)

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
          !!active &&
          (active.messages.length > 0 || isStreaming.value || isSending.value) &&
          active.id !== existing.id &&
          active.chatId !== existing.chatId
        if (activeBusy) return

        activeSessionId.value = existing.id
        loadSessionDraft(existing)
      }
      return
    }

    const active = activeSession.value
    const isEmptyPlaceholder =
      !!active && active.title === '新建对话' && !active.messages.length && !active.chatId

    // 进入画布默认展示「新建对话」，不自动用历史会话替换欢迎页
    if (isEmptyPlaceholder) return

    // 正在发送/流式中：不要用历史 tab 覆盖当前会话
    if (isStreaming.value || isSending.value || (active && active.messages.length > 0)) {
      // 若当前会话已绑定同一 chatId，只做 id 对齐
      if (active && (active.chatId === target.id || active.id === target.id)) {
        openSessionTab(target, { asDefault: false })
      }
      return
    }

    openSessionTab(target, { asDefault: false })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
  close()
  disposeTypewriters()
  sessions.value.forEach((session) => {
    session.draft.attachments.forEach((item: ChatAttachment) => {
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
  resetForProject,
  addAttachmentFromCanvas,
  addSkillFile,
  insertAssetMention,
  bindAttachmentNodeId,
})
</script>

<style lang="scss">
@use './chat/styles/chat-shell.scss' as *;
@use './chat/styles/chat-messages.scss' as *;
@use './chat/styles/chat-composer.scss' as *;
@use './chat/styles/chat-theme.scss' as *;
</style>
