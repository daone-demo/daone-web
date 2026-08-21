import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { message as antMessage } from 'ant-design-vue'
import api from '@/services/api'
import type { ChatAttachment, ChatSession } from '../chatTypes'
import type { StreamEvent } from './chatStreamParse'
import { collectGenerationTaskIds } from './chatStreamParse'
import { extractQuestionnaireFromHistoryItem } from './chatQuestionnaire'

export interface ChatHistorySession {
  id: string
  title?: string
  createdAt?: string | number
  updatedAt?: string | number
}

export interface UseChatSessionsOptions {
  attachments: Ref<ChatAttachment[]>
  assetMentions: Ref<Array<{ id: string; role: string; name: string }>>
  isStreaming: Readonly<Ref<boolean>>
  streamingMessageIds: Readonly<Ref<Set<string>>>
  scrollMessagesToBottom: () => void
  focusInput: () => void
  close: () => void
  cancelAllTypewriters: () => void
  clearAttachments: () => void
  clearAssetMentions: () => void
  /** 关闭标签时取消该会话附件的排队/校验/上传 */
  cancelSessionAttachments: (sessionId: string) => void
  clearSelectedSkill: () => void
  closeModelMenu: () => void
  closeSkillMenu: () => void
  emitSetCurrentSessionId: (sessionId: string) => void
  emitSetSessionName: (name: string) => void
  emitNewChat: () => void
}

export function useChatSessions(options: UseChatSessionsOptions) {
  const sessions = ref<ChatSession[]>([])
  const activeSessionId = ref('')
  const message = ref('')
  const historySearch = ref('')
  const showHistoryMenu = ref(false)
  const showAutoMenu = ref(false)
  const isSending = ref(false)
  const isProcessing = ref(false)

  const openTabs = computed(() => sessions.value.filter((item) => item.isOpen))
  const activeSession = computed(
    () => sessions.value.find((item) => item.id === activeSessionId.value) ?? null,
  )
  const messages = computed(() => activeSession.value?.messages ?? [])
  const isActive = computed(() => messages.value.length > 0)

  function createSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

  function createSessionFromHistory(item: ChatHistorySession): ChatSession {
    const parseTime = (value?: string | number) => {
      if (value == null) return Date.now()
      if (typeof value === 'number') return Number.isFinite(value) ? value : Date.now()
      return Date.parse(value) || Date.now()
    }
    return {
      id: item.id,
      chatId: item.id,
      title: item.title || '未命名对话',
      messages: [],
      draft: createEmptyDraft(),
      isOpen: true,
      createdAt: parseTime(item.createdAt),
      updatedAt: parseTime(item.updatedAt),
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
        generationTaskIds?: Array<string | number>
        mainTaskId?: string | number
        agentActions?: StreamEvent['agentActions']
        agentStatus?: string
      }>(chatId, { page: 1, pageSize: 100 })

      // 过期请求 / 正在发送或流式中，禁止覆盖本地消息
      if (messageLoadSeqByChatId.get(chatId) !== seq) return
      if (options.isStreaming.value || isSending.value) return

      const live = sessions.value.find(
        (item) => item.id === session.id || item.chatId === chatId || item.id === chatId,
      )
      if (!live) return

      // 本地已有临时消息（发送中或流式中），保留本地，避免打回欢迎页
      const hasLocalPending = live.messages.some(
        (item) => item.id.startsWith('msg-') || options.streamingMessageIds.value.has(item.id),
      )
      if (hasLocalPending) return

      const records = res.records ?? []
      live.messages = records.map((item, index) => {
        const role = String(item.role || '').toUpperCase() === 'USER' ? 'user' : 'assistant'
        const questionnaire =
          role === 'assistant' ? extractQuestionnaireFromHistoryItem(item) : undefined
        const questionnaireAnswered = Boolean(
          questionnaire &&
          records.slice(index + 1).some((next) => String(next.role || '').toUpperCase() === 'USER'),
        )

        return {
          id: item.id || `msg-${item.createdAt || Date.now()}`,
          role,
          text: item.content || '',
          kind: 'text' as const,
          questionnaire,
          questionnaireAnswered,
          generationTaskIds: collectGenerationTaskIds(item),
        }
      })
      options.scrollMessagesToBottom()
    } catch (error) {
      // 拉取失败时保留本地消息，不打断面板；给出可观测反馈
      console.error('[useChatSessions] load chat messages failed', error)
      antMessage.error('聊天记录加载失败，请稍后重试')
    }
  }

  function openSessionTab(
    historyItem: ChatHistorySession,
    tabOptions?: {
      asDefault?: boolean
      /** 是否拉取历史消息；初始化/props 同步时不拉，仅用户从历史打开时拉取 */
      loadMessages?: boolean
    },
  ) {
    const shouldLoadMessages = tabOptions?.loadMessages === true
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
      if (
        shouldLoadMessages &&
        !existing.messages.length &&
        !options.isStreaming.value &&
        !isSending.value
      ) {
        void loadSessionMessages(existing)
      }
      return existing
    }

    const session = createSessionFromHistory(historyItem)

    if (tabOptions?.asDefault) {
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
    if (shouldLoadMessages) {
      void loadSessionMessages(session)
    }
    return session
  }

  function saveActiveDraft() {
    const session = activeSession.value
    if (!session) return
    session.draft = {
      message: message.value,
      attachments: options.attachments.value.map((item) => ({ ...item })),
      assetMentions: options.assetMentions.value.map((item) => ({ ...item })),
    }
  }

  function loadSessionDraft(session: ChatSession) {
    message.value = session.draft.message
    options.attachments.value = session.draft.attachments.map((item) => ({ ...item }))
    options.assetMentions.value = session.draft.assetMentions.map((item) => ({ ...item }))
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
    options.scrollMessagesToBottom()
  }

  function openFromHistory(session: ChatHistorySession) {
    options.emitSetCurrentSessionId(session.id)
    options.emitSetSessionName(session.title || '未命名对话')
    showHistoryMenu.value = false
    openSessionTab(session, { loadMessages: true })
    options.focusInput()
  }

  function closeTab(sessionId: string) {
    const target = sessions.value.find((item) => item.id === sessionId)
    if (!target) return

    options.cancelSessionAttachments(sessionId)

    target.draft.attachments.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
    })

    target.isOpen = false

    if (!openTabs.value.length) {
      const session = createSession('新建对话', true)
      sessions.value.push(session)
      activeSessionId.value = session.id
      message.value = ''
      options.clearAttachments()
      options.clearAssetMentions()
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

  function startNewChat() {
    options.close()
    isProcessing.value = false
    saveActiveDraft()
    options.clearSelectedSkill()
    options.closeModelMenu()
    options.closeSkillMenu()

    const existingEmpty = sessions.value.find(
      (item) => item.isOpen && item.title === '新建对话' && !item.messages.length && !item.chatId,
    )
    if (existingEmpty) {
      activeSessionId.value = existingEmpty.id
      loadSessionDraft(existingEmpty)
      options.emitSetCurrentSessionId('')
      options.emitSetSessionName('新建对话')
      options.emitNewChat()
      options.focusInput()
      return
    }

    const session = createSession('新建对话', true)
    sessions.value.push(session)
    activeSessionId.value = session.id
    message.value = ''
    options.clearAttachments()
    options.clearAssetMentions()
    options.emitSetCurrentSessionId('')
    options.emitSetSessionName('新建对话')
    options.emitNewChat()
    options.focusInput()
  }

  function resetForProject() {
    options.close()
    isProcessing.value = false
    isSending.value = false
    options.cancelAllTypewriters()
    messageLoadSeqByChatId.clear()
    showHistoryMenu.value = false
    showAutoMenu.value = false
    options.closeModelMenu()
    options.closeSkillMenu()
    options.clearSelectedSkill()

    sessions.value.forEach((session) => {
      session.draft.attachments.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      })
    })

    options.clearAttachments()
    options.clearAssetMentions()
    message.value = ''

    const fresh = createSession('新建对话', true)
    sessions.value = [fresh]
    activeSessionId.value = fresh.id
    loadSessionDraft(fresh)
  }

  return {
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
    createSessionId,
    createEmptyDraft,
    createSession,
    createSessionFromHistory,
    messageLoadSeqByChatId,
    loadSessionMessages,
    openSessionTab,
    saveActiveDraft,
    loadSessionDraft,
    ensureActiveSession,
    switchSession,
    openFromHistory,
    closeTab,
    toggleHistoryMenu,
    startNewChat,
    resetForProject,
  }
}
