import { toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import api from '@/services/api'
import { getApiBaseURL, getToken } from '@/utils/request'
import type {
  ChatAttachment,
  ChatMessage,
  ChatSendPayload,
  ChatSession,
  ChatTaskCreatedPayload,
  QuestionnaireOption,
} from '../chatTypes'
import { CHAT_TIPS } from '../chatTypes'
import { setMessageTip } from './chatMarkdown'
import {
  collectGenerationTaskIds,
  extractGenerateImageTip,
  isBalanceError,
  isRunningTaskStatus,
  isTerminalTaskStatus,
  parseStreamEvent,
  pickStreamText,
  resolveStreamEventName,
  resolveStreamTaskName,
  resolveTaskStatusTip,
} from './chatStreamParse'
import type { StreamEvent } from './chatStreamParse'
import {
  applyQuestionnaireStep,
  buildQuestionnaireSubmitContent,
  extractQuestionnaireFromStreamPayload,
  getQuestionnaireCurrentAnswer,
  hasQuestionnaireCurrentAnswer,
  isQuestionnaireLastStep,
  joinQuestionnaireMultiValues,
  setQuestionnaireAnswer,
  splitQuestionnaireMultiValues,
  toggleQuestionnaireMultiOption,
} from './chatQuestionnaire'

export interface ChatSSEConnectOptions {
  url: string
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  onMessage?: (data: string, event?: string) => void
  onOpen?: () => void
  onError?: (error: unknown) => void
  onDone?: () => void
}

export interface UseChatStreamOptions {
  projectId: MaybeRefOrGetter<string | undefined>
  currentSessionId: MaybeRefOrGetter<string | undefined>
  sessions: Ref<ChatSession[]>
  activeSessionId: Ref<string>
  message: Ref<string>
  attachments: Ref<ChatAttachment[]>
  assetMentions: Ref<Array<{ id: string; role: string; name: string }>>
  selectedSkill: Ref<Record<string, any> | null>
  autoMode: Ref<string>
  isStreaming: Readonly<Ref<boolean>>
  isSending: Ref<boolean>
  isProcessing: Ref<boolean>
  canSend: Readonly<Ref<boolean>>
  messageLoadSeqByChatId: Map<string, number>
  streamingMessageIds: Readonly<Ref<Set<string>>>
  connect: (options: ChatSSEConnectOptions) => Promise<void>
  close: () => void
  resolveModel: (mode: string) => string
  ensureActiveSession: () => ChatSession
  saveActiveDraft: () => void
  clearAttachments: () => void
  clearAssetMentions: () => void
  clearSelectedSkill: () => void
  scrollMessagesToBottom: () => void
  cancelTypewriter: (messageId: string) => void
  streamAssistantText: (
    assistant: ChatMessage,
    fullText: string,
    mode?: 'replace' | 'append',
  ) => Promise<void>
  cancelAllTypewriters: () => void
  emitSend: (payload: ChatSendPayload) => void
  emitSetCurrentSessionId: (sessionId: string) => void
  emitLoadHistorySessions: () => void
  emitTaskCreated: (payload: ChatTaskCreatedPayload) => void
  emitTaskUpdated: (payload: { taskId: string | number; taskName: string; projectId?: string }) => void
}

export function useChatStream(options: UseChatStreamOptions) {
  /** 每次切项目 / 主动作废时递增，用于丢弃 in-flight 创建会话与 SSE 回调 */
  let chatRequestEpoch = 0

  function invalidatePendingChatRequests() {
    chatRequestEpoch += 1
    options.close()
  }

  function currentProjectId() {
    return String(toValue(options.projectId) ?? '').trim()
  }

  /** 发送上下文是否仍归属当前项目与面板会话（切项目 reset 后旧 session 会失效） */
  function isChatSendContextValid(session: ChatSession, requestProjectId: string, epoch: number) {
    if (epoch !== chatRequestEpoch) return false
    const liveProjectId = currentProjectId()
    if (requestProjectId && liveProjectId !== requestProjectId) return false
    return options.sessions.value.some(
      (item) =>
        item === session
        || item.id === session.id
        || (Boolean(session.chatId) && item.chatId === session.chatId),
    )
  }

  function emitTaskUpdatesFromPayload(payload: StreamEvent, projectId?: string) {
    const taskName = resolveStreamTaskName(payload)
    if (!taskName) return

    const taskIds = new Set<string>()
    const directTaskId = String(payload.taskId ?? '').trim()
    if (directTaskId) taskIds.add(directTaskId)
    collectGenerationTaskIds(payload).forEach((id) => taskIds.add(id))

    taskIds.forEach((taskId) => {
      options.emitTaskUpdated({ taskId, taskName, projectId })
    })
  }

  function applyStreamAgentPayload(
    assistant: ChatMessage,
    payload: StreamEvent,
  ) {
    const questionnaire = extractQuestionnaireFromStreamPayload(payload)
    if (questionnaire) {
      assistant.questionnaire = questionnaire
      if (!assistant.text.trim()) {
        assistant.text = questionnaire.question
      }
    } else if (payload.content && !assistant.text.trim()) {
      assistant.text = payload.content
    }

    const taskIds = collectGenerationTaskIds(payload)
    if (taskIds.length) {
      assistant.generationTaskIds = taskIds
    }

    const generateTip = extractGenerateImageTip(payload)
    if (generateTip) {
      setMessageTip(assistant, generateTip)
    } else if (payload.agentStatus && payload.agentStatus !== 'NEED_INPUT') {
      setMessageTip(assistant, undefined)
    } else if (questionnaire) {
      setMessageTip(assistant, undefined)
    }
  }

  function startChatStream(
    session: ChatSession,
    text: string,
    assetIds: string[] = [],
    streamOptions: { nodeId?: string; skillName?: string } = {},
    streamMeta: { projectId: string; epoch: number } = {
      projectId: currentProjectId(),
      epoch: chatRequestEpoch,
    },
  ) {
    const chatId = session.chatId || toValue(options.currentSessionId)
    if (!chatId) return

    const boundProjectId = streamMeta.projectId
    const streamEpoch = streamMeta.epoch
    const isStreamStale = () => !isChatSendContextValid(session, boundProjectId, streamEpoch)

    // 绑定当前会话引用，流式过程中始终写回同一份 messages
    const targetSessionId = session.id
    const assistantId = `msg-${Date.now()}-assistant`
    session.messages.push({
      id: assistantId,
      role: 'assistant',
      text: '',
      kind: 'text',
      tip: '思考中...',
      tipWave: true,
    })
    options.scrollMessagesToBottom()

    const resolveSession = () =>
      options.sessions.value.find(
        (item) => item.id === targetSessionId || item.chatId === chatId || item.id === chatId,
      ) ?? session

    const resolveAssistant = () => {
      const current = resolveSession()
      return current.messages.find((item) => item.id === assistantId)
    }

    // 收到 task_status=RUNNING 后，后台任务仍在执行；流结束/网络抖动时不当作请求失败
    let awaitingRunningTask = false
    // 已收到任意 SSE 事件（如 agent_thinking），连接中断时不展示硬失败
    let streamHasProgress = false

    const rememberTaskId = (assistant: ChatMessage, taskId: unknown) => {
      const normalized = String(taskId ?? '').trim()
      if (!normalized) return
      assistant.generationTaskIds = Array.from(
        new Set([...(assistant.generationTaskIds ?? []), normalized]),
      )
    }

    const token = getToken()
    const skillName = streamOptions.skillName?.trim()
    const nodeId = streamOptions.nodeId?.trim()
    void options.connect({
      url: `${getApiBaseURL().replace(/\/$/, '')}/chat-sessions/${chatId}/messages/stream`,
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: {
        model: options.resolveModel(options.autoMode.value),
        content: text,
        stream: true,
        ...(assetIds.length ? { attachmentAssetIds: assetIds } : {}),
        ...(skillName ? { skillName } : {}),
        ...(nodeId ? { nodeId } : {}),
      },
      onMessage(data, sseEvent) {
        if (isStreamStale()) {
          options.close()
          return
        }
        const payload = parseStreamEvent(data)
        if (!payload) return

        streamHasProgress = true
        const eventName = resolveStreamEventName(payload, sseEvent)

        if (eventName === 'task_created') {
          const assistant = resolveAssistant()
          const taskName = resolveStreamTaskName(payload)
          if (assistant) {
            rememberTaskId(assistant, payload.taskId)
            awaitingRunningTask = true
            setMessageTip(
              assistant,
              taskName ? `已创建任务「${taskName}」，处理中...` : '已创建生成任务，处理中...',
            )
          } else {
            awaitingRunningTask = true
          }
          options.emitTaskCreated({
            taskId: payload.taskId as string | number,
            taskType: payload.taskType,
            taskName: taskName || payload.taskName,
            prompt: payload.prompt,
            capabilityCode: payload.capabilityCode,
            nodeId: payload.nodeId,
            parentNodeId: payload.parentNodeId,
            projectId: boundProjectId || undefined,
          })
          options.scrollMessagesToBottom()
          return
        }

        const assistant = resolveAssistant()
        if (!assistant) return

        if (eventName === 'user_message') {
          return
        }

        if (eventName === 'agent_thinking') {
          // 正文打字机进行中时不打断；已有正文时仍可更新思考态 tip（海浪动效）
          if (options.streamingMessageIds.value.has(assistant.id)) {
            return
          }
          const thinkingMessage = typeof payload.message === 'string' ? payload.message.trim() : ''
          setMessageTip(assistant, thinkingMessage || '思考中...', true)
          options.scrollMessagesToBottom()
          return
        }

        // 服务端显式结束流：立即隐藏 thinking / 处理中 tip
        if (eventName === 'done') {
          setMessageTip(assistant, undefined)
          options.scrollMessagesToBottom()
          return
        }

        if (eventName === 'task_status' || eventName === 'task_progress') {
          rememberTaskId(assistant, payload.taskId)
          const taskName = resolveStreamTaskName(payload)
          if (taskName && payload.taskId != null) {
            options.emitTaskUpdated({
              taskId: payload.taskId as string | number,
              taskName,
              projectId: boundProjectId || undefined,
            })
          }

          if (eventName === 'task_status') {
            if (isRunningTaskStatus(payload.status)) {
              awaitingRunningTask = true
              setMessageTip(assistant, resolveTaskStatusTip(payload))
            } else if (isTerminalTaskStatus(payload.status)) {
              awaitingRunningTask = false
              const tip = resolveTaskStatusTip(payload)
              const failed = /FAIL|ERROR|CANCEL/i.test(String(payload.status || ''))
              if (failed) {
                setMessageTip(assistant, tip)
              } else if (!assistant.text.trim()) {
                setMessageTip(assistant, tip)
              } else {
                setMessageTip(assistant, undefined)
              }
            } else {
              setMessageTip(assistant, resolveTaskStatusTip(payload))
            }
          } else {
            // task_progress：任务仍在推进，保持等待态
            awaitingRunningTask = true
            const progressTip = resolveTaskStatusTip(payload)
            if (
              typeof payload.completed === 'number'
              && typeof payload.total === 'number'
              && payload.total > 0
            ) {
              setMessageTip(assistant, `${progressTip}（${payload.completed}/${payload.total}）`)
            } else {
              setMessageTip(assistant, progressTip)
            }
          }

          options.scrollMessagesToBottom()
          return
        }

        if (eventName === 'tool_result' || eventName === 'tool_res') {
          if (payload.success === false && payload.summary) {
            if (!assistant.text.trim() && !payload.summary.includes('工具不存在')) {
              void options.streamAssistantText(assistant, payload.summary, 'replace')
            }
          }
          return
        }

        if (eventName === 'tool_call' && payload.tool === 'ask_user') {
          const questionnaire = extractQuestionnaireFromStreamPayload(payload)
          if (questionnaire) {
            assistant.questionnaire = questionnaire
            void options.streamAssistantText(assistant, questionnaire.question, 'replace')
          }
          return
        }

        if (eventName === 'ai_message') {
          if (payload.id) {
            assistant.id = String(payload.id)
          }

          applyStreamAgentPayload(assistant, payload)
          emitTaskUpdatesFromPayload(payload, boundProjectId || undefined)
          if (assistant.generationTaskIds?.length) {
            awaitingRunningTask = true
          }

          options.cancelTypewriter(assistant.id)
          options.scrollMessagesToBottom()
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
          void options.streamAssistantText(assistant, chunk, 'replace')
        } else {
          // delta / content 增量：直接追加
          options.cancelTypewriter(assistant.id)
          assistant.text += chunk
          setMessageTip(assistant, undefined)
          options.scrollMessagesToBottom()
        }
      },
      onDone() {
        if (isStreamStale()) return
        options.cancelTypewriter(assistantId)
        const assistant = resolveAssistant()
        // event=done / 流结束：隐藏 thinking 与处理中 tip（后台任务进度由任务事件单独驱动）
        if (assistant) {
          setMessageTip(assistant, undefined)
        }
        if (
          assistant
          && !assistant.text.trim()
          && !assistant.questionnaire
          && !awaitingRunningTask
        ) {
          assistant.text = '暂无回复，请稍后重试。'
        }
        options.scrollMessagesToBottom()
      },
      onError(err) {
        if (isStreamStale()) return
        options.cancelTypewriter(assistantId)
        const assistant = resolveAssistant()
        if (!assistant) return

        const errorMessage = err instanceof Error ? err.message : '未知错误'

        if (isBalanceError(errorMessage)) {
          assistant.kind = 'balance_error'
          assistant.text = ''
          setMessageTip(assistant, undefined)
          awaitingRunningTask = false
        } else if (
          awaitingRunningTask
          || (streamHasProgress && Boolean(assistant.tip?.trim()) && !assistant.text.trim())
        ) {
          // 已收到 agent_thinking / 任务进度等：SSE 抖动或中途断开时不展示「请求失败」
          if (!assistant.tip) {
            setMessageTip(assistant, '处理中...', true)
          }
        } else if (!assistant.text.trim()) {
          assistant.text = '请求失败，请稍后重试。'
          setMessageTip(assistant, errorMessage)
        } else {
          setMessageTip(assistant, errorMessage)
        }

        options.scrollMessagesToBottom()
      },
    })
  }

  async function ensureChatSession(
    session: ChatSession,
    title: string,
    requestMeta: { projectId: string; epoch: number },
  ) {
    // 已有服务端会话 ID：同步到本地后直接复用
    const existingId = session.chatId || toValue(options.currentSessionId)
    if (existingId) {
      if (!isChatSendContextValid(session, requestMeta.projectId, requestMeta.epoch)) {
        return ''
      }
      session.chatId = existingId
      if (session.id !== existingId) {
        const oldId = session.id
        session.id = existingId
        if (options.activeSessionId.value === oldId) {
          options.activeSessionId.value = existingId
        }
      }
      return existingId
    }

    const created = await api.createChatSession({
      projectId: requestMeta.projectId || toValue(options.projectId),
      title,
    })
    // 切项目后迟到的创建结果不得回写面板或启动 SSE
    if (!isChatSendContextValid(session, requestMeta.projectId, requestMeta.epoch)) {
      return ''
    }
    const oldId = session.id
    session.chatId = created.id
    session.id = created.id
    session.title = created.title || title
    session.updatedAt = Date.now()
    if (options.activeSessionId.value === oldId) {
      options.activeSessionId.value = created.id
    }
    options.emitSetCurrentSessionId(created.id)
    options.emitLoadHistorySessions()
    return created.id
  }

  function buildMessageText() {
    const mentionText = options.assetMentions.value
      .map((item) => `@${item.role} ${item.name}`)
      .join(' ')
    const skillPrefix = options.selectedSkill.value
      ? `${options.selectedSkill.value.command || options.selectedSkill.value.displayName || options.selectedSkill.value.name}`
      : ''
    const body = options.message.value.trim()
    return [mentionText, skillPrefix, body].filter(Boolean).join(' ')
  }

  function sendMessage() {
    if (
      options.isStreaming.value
      || options.isProcessing.value
      || options.isSending.value
      || !options.canSend.value
    ) return

    const session = options.ensureActiveSession()
    const text = buildMessageText()
    // 未上传到 OSS 的附件预览仍是 blob URL，发送后会被 clearAttachments 撤销，
    // 因此为已发送消息复制一份独立的 blob URL，保证缩略图不会失效
    const payloadAttachments = options.attachments.value.map((item) => (
      item.previewUrl.startsWith('blob:') && item.file.size
        ? { ...item, previewUrl: URL.createObjectURL(item.file) }
        : { ...item }
    ))
    if (!text && !payloadAttachments.length) return

    // 对话框中存在媒体资源时，收集其 assetId（画布附件 + @素材引用），随消息一起发送
    const assetIds = Array.from(
      new Set(
        [
          ...payloadAttachments.map((item) => item.assetId),
          ...options.assetMentions.value.map((item) => item.id),
        ].filter((id): id is string => Boolean(id)),
      ),
    )
    const nodeId =
      payloadAttachments.map((item) => item.nodeId?.trim()).find((id): id is string => Boolean(id)) ||
      undefined
    const skillName = String(
      options.selectedSkill.value?.name ?? options.selectedSkill.value?.skillName ?? '',
    ).trim() || undefined

    void onSendMessage(session, payloadAttachments, text, assetIds, { nodeId, skillName })
  }

  async function onSendMessage(
    session: ChatSession,
    payloadAttachments: ChatAttachment[],
    text: string,
    assetIds: string[] = [],
    streamOptions: { nodeId?: string; skillName?: string } = {},
  ) {
    const title = session.title === '新建对话'
      ? (text || payloadAttachments[0]?.fileName || '新建对话')
      : session.title

    const requestProjectId = currentProjectId()
    const requestEpoch = chatRequestEpoch

    options.isSending.value = true
    try {
      const chatId = await ensureChatSession(session, title, {
        projectId: requestProjectId,
        epoch: requestEpoch,
      })
      if (!chatId) return
      if (!isChatSendContextValid(session, requestProjectId, requestEpoch)) return

      // 作废进行中的历史消息拉取，防止回写覆盖本地对话
      options.messageLoadSeqByChatId.set(
        chatId,
        (options.messageLoadSeqByChatId.get(chatId) ?? 0) + 1,
      )

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

      options.message.value = ''
      options.clearAttachments()
      options.clearAssetMentions()
      options.clearSelectedSkill()
      options.saveActiveDraft()
      options.scrollMessagesToBottom()
      if (text) {
        options.emitSend({ text, attachments: payloadAttachments })
        startChatStream(session, text, assetIds, streamOptions, {
          projectId: requestProjectId,
          epoch: requestEpoch,
        })
      }
    } catch {
      // ensureChatSession 失败时由请求层提示
    } finally {
      options.isSending.value = false
    }
  }

  function onQuestionnaireOptionPick(message: ChatMessage, option: QuestionnaireOption) {
    if (
      options.isStreaming.value
      || options.isProcessing.value
      || options.isSending.value
      || message.questionnaireAnswered
    ) return
    if (message.questionnaire?.allowMulti) {
      toggleQuestionnaireMultiOption(message, option)
      return
    }
    setQuestionnaireAnswer(message, option.value || option.label)
  }

  function onQuestionnaireCustomInput(message: ChatMessage, value: string) {
    if (
      options.isStreaming.value
      || options.isProcessing.value
      || options.isSending.value
      || message.questionnaireAnswered
    ) return
    if (message.questionnaire?.allowMulti) {
      // 多选：自定义文本替换答案中的自定义部分，保留已选预设选项
      const optionValues = new Set(
        (message.questionnaire.options ?? []).map((item) => item.value || item.label),
      )
      const selected = splitQuestionnaireMultiValues(getQuestionnaireCurrentAnswer(message))
        .filter((item) => optionValues.has(item))
      const custom = value.trim()
      setQuestionnaireAnswer(
        message,
        joinQuestionnaireMultiValues(custom ? [...selected, custom] : selected),
      )
      return
    }
    setQuestionnaireAnswer(message, value)
  }

  function onQuestionnairePrev(message: ChatMessage) {
    if (
      options.isStreaming.value
      || options.isProcessing.value
      || options.isSending.value
      || message.questionnaireAnswered
    ) return
    const questionnaire = message.questionnaire
    if (!questionnaire || questionnaire.step <= 1) return
    applyQuestionnaireStep(message, questionnaire.step - 2)
  }

  function submitQuestionnaire(message: ChatMessage) {
    if (!hasQuestionnaireCurrentAnswer(message)) return

    message.questionnaireAnswered = true
    const submitContent = buildQuestionnaireSubmitContent(message)
      || getQuestionnaireCurrentAnswer(message)
    const session = options.ensureActiveSession()
    void onSendMessage(session, [], submitContent, [])
  }

  function onQuestionnaireNext(message: ChatMessage) {
    if (
      options.isStreaming.value
      || options.isProcessing.value
      || options.isSending.value
      || message.questionnaireAnswered
    ) return
    if (!hasQuestionnaireCurrentAnswer(message)) return

    const questionnaire = message.questionnaire
    if (!questionnaire) return

    // 无多步数据或已是最后一步：直接提交
    if (!questionnaire.steps?.length || isQuestionnaireLastStep(message)) {
      submitQuestionnaire(message)
      return
    }

    applyQuestionnaireStep(message, questionnaire.step)
  }

  function stopProcessing() {
    invalidatePendingChatRequests()
    options.isProcessing.value = false
    options.cancelAllTypewriters()
  }

  function beginProcessing() {
    options.isProcessing.value = true
  }

  function endProcessing() {
    options.isProcessing.value = false
  }

  return {
    startChatStream,
    applyStreamAgentPayload,
    emitTaskUpdatesFromPayload,
    ensureChatSession,
    buildMessageText,
    sendMessage,
    onSendMessage,
    onQuestionnaireOptionPick,
    onQuestionnaireCustomInput,
    onQuestionnairePrev,
    onQuestionnaireNext,
    submitQuestionnaire,
    stopProcessing,
    beginProcessing,
    endProcessing,
    invalidatePendingChatRequests,
  }
}
