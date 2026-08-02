export interface ChatAttachment {
  id: string
  file: File
  previewUrl: string
  fileName: string
  /** 媒体资源对应的素材库资源 ID（画布加入对话框时透传） */
  assetId?: string
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

export interface Questionnaire {
  question: string
  step: number
  totalSteps: number
  allowCustom: boolean
  options: QuestionnaireOption[]
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

export const CHAT_TIPS = [
  '提示：将文件拖入工作区即可作为素材使用。',
  'Tip: Subtitle style changes can be applied to the current caption or all captions.',
  'Tip: Drag files into the workspace to use them as assets.',
]
