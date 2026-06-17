export interface ChatAttachment {
  id: string
  file: File
  previewUrl: string
  fileName: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  attachments?: ChatAttachment[]
  tip?: string
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
