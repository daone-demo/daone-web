import type { ChatAttachment } from '../chatTypes'

export type SessionDraftMessageAccess = {
  getActiveSessionId: () => string
  getMessage: () => string
  setMessage: (message: string) => void
  getSessionDraftMessage?: (sessionId: string) => string | undefined
  setSessionDraftMessage?: (sessionId: string, message: string) => void
  /** 注入 strip，避免本模块硬依赖 @/ 别名（便于 node 测试） */
  stripImageMentions: (message: string) => string
}

/** 清空附件后同步去掉草稿中的 @图片N */
export function stripSessionDraftImageMentions(
  sessionId: string,
  access: SessionDraftMessageAccess,
): void {
  const id = String(sessionId || '').trim()
  if (!id) return

  if (id === access.getActiveSessionId()) {
    const prev = access.getMessage()
    const next = access.stripImageMentions(prev)
    if (next !== prev) access.setMessage(next)
    return
  }

  const prev = access.getSessionDraftMessage?.(id)
  if (prev === undefined) return
  const next = access.stripImageMentions(prev)
  if (next !== prev) access.setSessionDraftMessage?.(id, next)
}

export type ClearSessionDraftAttachmentsInput = {
  sessionId: string
  isActive: boolean
  attachments: ChatAttachment[]
  /** 非活动会话：可变的草稿附件数组（原地 splice） */
  inactiveDraftAttachments?: ChatAttachment[]
  revokeObjectURL?: (url: string) => void
  onAbortAttachment?: (attachmentId: string) => void
  saveActiveDraft?: () => void
} & SessionDraftMessageAccess

/**
 * 关闭标签策略：清空附件、释放 Blob、同步 strip @图片N。
 * 返回被清空的附件 id 列表，便于外层中止上传队列。
 */
export function clearSessionDraftAttachmentsState(
  input: ClearSessionDraftAttachmentsInput,
): string[] {
  const id = String(input.sessionId || '').trim()
  if (!id) return []

  const revoke = input.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url))
  const abort = input.onAbortAttachment
  const clearedIds: string[] = []

  const revokeList = (list: ChatAttachment[]) => {
    for (const item of list) {
      clearedIds.push(item.id)
      abort?.(item.id)
      if (item.previewUrl?.startsWith('blob:')) {
        revoke(item.previewUrl)
      }
    }
  }

  if (input.isActive) {
    revokeList(input.attachments)
    input.attachments.splice(0, input.attachments.length)
    stripSessionDraftImageMentions(id, input)
    input.saveActiveDraft?.()
    return clearedIds
  }

  const draftList = input.inactiveDraftAttachments
  if (!draftList) return clearedIds
  revokeList(draftList)
  draftList.splice(0, draftList.length)
  stripSessionDraftImageMentions(id, input)
  return clearedIds
}
