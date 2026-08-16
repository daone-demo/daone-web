import type { ChatAttachment } from '../chatTypes'

export interface OwnedAttachmentTarget {
  attachment: ChatAttachment
  attachments: ChatAttachment[]
  isActiveSession: boolean
}

/**
 * 按上传开始时捕获的会话 ID 查找附件，避免异步完成后误写当前会话。
 */
export function findOwnedAttachmentTarget(
  ownerSessionId: string,
  activeSessionId: string,
  activeAttachments: ChatAttachment[],
  getSessionAttachments: (sessionId: string) => ChatAttachment[] | undefined,
  attachmentId: string,
): OwnedAttachmentTarget | undefined {
  const isActiveSession = ownerSessionId === activeSessionId
  const attachments = isActiveSession
    ? activeAttachments
    : getSessionAttachments(ownerSessionId)
  const attachment = attachments?.find((item) => item.id === attachmentId)
  if (!attachments || !attachment) return undefined
  return { attachment, attachments, isActiveSession }
}
