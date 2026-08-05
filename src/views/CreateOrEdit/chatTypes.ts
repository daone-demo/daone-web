export interface ChatAttachment {
  id: string
  file: File
  previewUrl: string
  fileName: string
  /** 媒体资源对应的素材库资源 ID（画布加入对话框时透传） */
  assetId?: string
  /** 画布节点 ID（添加到智能体时透传，发送消息时一并提交） */
  nodeId?: string
  /** 是否正在上传到 OSS */
  uploading?: boolean
  /** 上传失败时的错误信息 */
  uploadError?: string
}

export interface QuestionnaireOption {
  label: string
  value: string
  description?: string
}

export interface QuestionnaireStep {
  name?: string
  /** 中文标签，用于拼接答案摘要，如「平台」「受众」 */
  label?: string
  question: string
  allowCustom: boolean
  options: QuestionnaireOption[]
}

export interface Questionnaire {
  /** 问卷总述 / 首屏说明 */
  question: string
  /** 当前步骤（1-based） */
  step: number
  totalSteps: number
  allowCustom: boolean
  /** 当前步骤选项（兼容单题 / 多步） */
  options: QuestionnaireOption[]
  /** 多步问卷完整步骤；有值时前端本地推进 */
  steps?: QuestionnaireStep[]
  /** 当前步骤标题（来自 steps[i].question） */
  stepQuestion?: string
  /** 当前步骤 name，用于答案回传 */
  stepName?: string
  /** 当前步骤中文标签 */
  stepLabel?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  kind?: 'text' | 'balance_error'
  attachments?: ChatAttachment[]
  tip?: string
  questionnaire?: Questionnaire
  questionnaireAnswered?: boolean
  /** 多步问卷已选答案：stepName/stepIndex -> label */
  questionnaireAnswers?: Record<string, string>
  /** 生图任务 ID（来自 SSE generationTaskIds / GENERATE_IMAGE） */
  generationTaskIds?: string[]
}

export interface ChatDraft {
  message: string
  attachments: ChatAttachment[]
  assetMentions: Array<{ id: string; role: string; name: string }>
}

export interface ChatSession {
  id: string
  chatId: string | null
  title: string
  messages: ChatMessage[]
  draft: ChatDraft
  isOpen: boolean
  createdAt: number
  updatedAt: number
}

export interface ChatSendPayload {
  text: string
  attachments: ChatAttachment[]
}

/** 对话 SSE task_created 事件，用于在画布创建生成节点 */
export interface ChatTaskCreatedPayload {
  taskId: string | number
  taskType?: string
  taskName?: string
  prompt?: string
  capabilityCode?: string
  /** 服务端预分配的结果节点 ID */
  nodeId?: string
  /** 画布上的上游节点 ID，创建结果节点后自动连线 */
  parentNodeId?: string
}

export const CHAT_TIPS = [
  '提示：将文件拖入工作区即可作为素材使用。',
  'Tip: Subtitle style changes can be applied to the current caption or all captions.',
  'Tip: Drag files into the workspace to use them as assets.',
]
