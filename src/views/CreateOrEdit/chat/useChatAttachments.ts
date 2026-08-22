import { ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { message } from 'ant-design-vue'
import { mintMediaProxyCandidates } from '@/components/Canvas/mediaProxy'
import { uploadAssetFile } from '@/components/Canvas/upload'
import {
  removeImageRefMentionFromPrompt,
  stripAllImageRefMentionsFromPrompt,
} from '@/components/Canvas/promptMention'
import type { ChatAttachment } from '../chatTypes'
import { findOwnedAttachmentTarget } from './chatAttachmentOwner'
import {
  validateChatImageFile,
  validateChatImageFileAsync,
  planChatAttachmentBatch,
  CHAT_ATTACHMENT_MAX_COUNT,
  CHAT_UPLOAD_MAX_CONCURRENCY,
} from './chatAttachmentValidate'
import {
  bumpUploadQueueGeneration,
  completeChatUploadSlot,
  createChatUploadQueueState,
  enqueueChatUpload,
  pumpChatUploadQueue,
  removeChatUploadFromQueue,
  type ChatUploadQueueState,
} from './chatAttachmentUploadQueue'
import {
  bumpSessionAttachOpGeneration,
  getSessionAttachOpGeneration,
  isSessionAttachOpCurrent,
} from './chatAttachmentSessionOps'
import {
  clearSessionDraftAttachmentsState,
} from './chatAttachmentDraftClear'

export interface InsertImageToCanvasPayload {
  attachmentId: string
  assetId?: string
  previewUrl: string
  fileName?: string
  width?: number | null
  height?: number | null
}

export interface UseChatAttachmentsOptions {
  projectId: MaybeRefOrGetter<string | undefined>
  emitInsertImageToCanvas: (payload: InsertImageToCanvasPayload) => void
  ensureActiveSession: () => { id: string }
  getActiveSessionId: () => string
  getSessionAttachments: (sessionId: string) => ChatAttachment[] | undefined
  /** 非活动会话草稿正文；关闭标签清空附件时需同步 strip @图片N */
  getSessionDraftMessage?: (sessionId: string) => string | undefined
  setSessionDraftMessage?: (sessionId: string, message: string) => void
  focusInput: () => void
  saveActiveDraft: () => void
  getMessage: () => string
  setMessage: (message: string) => void
}

function buildCanvasFetchDedupeKey(payload: {
  previewUrl: string
  assetId?: string
  nodeId?: string
  sessionId?: string
  projectId?: string
}) {
  return [
    String(payload.projectId ?? '').trim(),
    String(payload.sessionId ?? '').trim(),
    String(payload.assetId ?? '').trim(),
    String(payload.nodeId ?? '').trim(),
    String(payload.previewUrl ?? '').trim(),
  ].join('|')
}

export function useChatAttachments(options: UseChatAttachmentsOptions) {
  const attachments = ref<ChatAttachment[]>([])
  const assetMentions = ref<Array<{ id: string; role: string; name: string }>>([])
  const fileInputRef = ref<HTMLInputElement | null>(null)

  /** 项目/会话重置时递增，作废进行中的画布拉取 */
  let attachmentFetchEpoch = 0
  /** previewUrl/assetId/nodeId → 进行中的拉取，避免重复插入上传 */
  const canvasFetchInflight = new Map<string, string>()
  /** attachmentId → AbortController（画布拉取） */
  const canvasFetchAbortById = new Map<string, AbortController>()
  /** attachmentId → AbortController（OSS 直传） */
  const uploadAbortById = new Map<string, AbortController>()
  /** 待直传队列（绑定 session/project/generation） */
  let uploadQueueState: ChatUploadQueueState = createChatUploadQueueState()
  /** 串行化 addAttachments，避免双 drop 同时突破数量上限 */
  let addAttachmentsChain: Promise<void> = Promise.resolve()
  /** 每会话附件操作 generation：关闭标签时 bump，作废预提交校验链 */
  const sessionAttachOpGen = new Map<string, number>()

  function currentProjectId() {
    return String(toValue(options.projectId) ?? '').trim()
  }

  function isOwnerContextValid(owner: { sessionId: string; projectId: string; epoch: number }) {
    if (owner.epoch !== attachmentFetchEpoch) return false
    if (owner.projectId !== currentProjectId()) return false
    return true
  }

  function isOwnedAddStillValid(
    owner: { sessionId: string; projectId: string; epoch: number },
    opGeneration: number,
  ) {
    if (!isSessionAttachOpCurrent(sessionAttachOpGen, owner.sessionId, opGeneration)) {
      return false
    }
    return isOwnerContextValid(owner)
  }

  function getOwnerAttachmentCount(sessionId: string): number {
    if (sessionId === options.getActiveSessionId()) {
      return attachments.value.length
    }
    return options.getSessionAttachments(sessionId)?.length ?? 0
  }

  function appendOwnerAttachment(sessionId: string, attachment: ChatAttachment): boolean {
    if (sessionId === options.getActiveSessionId()) {
      attachments.value.push(attachment)
      options.saveActiveDraft()
      return true
    }
    const list = options.getSessionAttachments(sessionId)
    if (!list) return false
    list.push(attachment)
    return true
  }

  function isFetchContextValid(owner: {
    sessionId: string
    projectId: string
    epoch: number
    attachmentId: string
  }) {
    if (!isOwnerContextValid(owner)) return false
    return Boolean(findSessionAttachment(owner.sessionId, owner.attachmentId))
  }

  function abortCanvasFetch(attachmentId: string) {
    const controller = canvasFetchAbortById.get(attachmentId)
    if (controller) {
      controller.abort()
      canvasFetchAbortById.delete(attachmentId)
    }
    for (const [key, id] of canvasFetchInflight) {
      if (id === attachmentId) canvasFetchInflight.delete(key)
    }
  }

  function abortAttachmentUpload(attachmentId: string) {
    const controller = uploadAbortById.get(attachmentId)
    if (controller) {
      controller.abort()
      uploadAbortById.delete(attachmentId)
    }
    uploadQueueState = removeChatUploadFromQueue(uploadQueueState, attachmentId)
  }

  function enqueueAttachmentUpload(item: {
    attachmentId: string
    sessionId: string
    projectId: string
  }) {
    if (uploadAbortById.has(item.attachmentId)) return
    uploadQueueState = enqueueChatUpload(uploadQueueState, item)
    pumpUploadQueue()
  }

  function pumpUploadQueue() {
    const pumped = pumpChatUploadQueue(
      uploadQueueState,
      (item) => Boolean(findSessionAttachment(item.sessionId, item.attachmentId)),
      CHAT_UPLOAD_MAX_CONCURRENCY,
    )
    uploadQueueState = pumped.state
    for (const item of pumped.started) {
      const gen = item.generation
      void uploadAttachmentToOss(item.attachmentId, {
        sessionId: item.sessionId,
        projectId: item.projectId,
      }).finally(() => {
        uploadQueueState = completeChatUploadSlot(uploadQueueState, gen)
        if (gen === uploadQueueState.generation) {
          pumpUploadQueue()
        }
      })
    }
  }

  /** 切项目 / 重置会话时调用：取消所有进行中的画布附件拉取与上传 */
  function invalidateAttachmentFetches() {
    attachmentFetchEpoch += 1
    canvasFetchAbortById.forEach((controller) => controller.abort())
    canvasFetchAbortById.clear()
    canvasFetchInflight.clear()
    uploadAbortById.forEach((controller) => controller.abort())
    uploadAbortById.clear()
    // bump generation：旧 finally 不得改写新队列计数
    uploadQueueState = bumpUploadQueueGeneration(uploadQueueState)
    // 作废所有会话上尚未提交的 add 校验链
    for (const sessionId of sessionAttachOpGen.keys()) {
      bumpSessionAttachOpGeneration(sessionAttachOpGen, sessionId)
    }
  }

  /** 清空会话草稿附件并释放 Blob（关闭标签不保留不可恢复 uploading 态） */
  function clearSessionDraftAttachments(sessionId: string) {
    const id = String(sessionId || '').trim()
    if (!id) return

    const isActive = id === options.getActiveSessionId()
    if (isActive) {
      clearSessionDraftAttachmentsState({
        sessionId: id,
        isActive: true,
        attachments: attachments.value,
        getActiveSessionId: options.getActiveSessionId,
        getMessage: options.getMessage,
        setMessage: options.setMessage,
        getSessionDraftMessage: options.getSessionDraftMessage,
        setSessionDraftMessage: options.setSessionDraftMessage,
        stripImageMentions: stripAllImageRefMentionsFromPrompt,
        saveActiveDraft: options.saveActiveDraft,
        onAbortAttachment: (attachmentId) => {
          abortAttachmentUpload(attachmentId)
          abortCanvasFetch(attachmentId)
        },
      })
      // clearSessionDraftAttachmentsState 对传入数组 splice；同步到 ref
      attachments.value = [...attachments.value]
      return
    }

    const draftList = options.getSessionAttachments(id)
    if (!draftList) return
    clearSessionDraftAttachmentsState({
      sessionId: id,
      isActive: false,
      attachments: [],
      inactiveDraftAttachments: draftList,
      getActiveSessionId: options.getActiveSessionId,
      getMessage: options.getMessage,
      setMessage: options.setMessage,
      getSessionDraftMessage: options.getSessionDraftMessage,
      setSessionDraftMessage: options.setSessionDraftMessage,
      stripImageMentions: stripAllImageRefMentionsFromPrompt,
      onAbortAttachment: (attachmentId) => {
        abortAttachmentUpload(attachmentId)
        abortCanvasFetch(attachmentId)
      },
    })
  }

  /** 关闭标签时：作废 add 链、取消排队/校验/上传，并清空不可恢复草稿 */
  function cancelSessionAttachments(sessionId: string) {
    const id = String(sessionId || '').trim()
    if (!id) return

    bumpSessionAttachOpGeneration(sessionAttachOpGen, id)

    const draftList =
      id === options.getActiveSessionId() ? attachments.value : options.getSessionAttachments(id)
    const attachmentIds = new Set((draftList || []).map((item) => item.id))

    for (const item of uploadQueueState.items) {
      if (item.sessionId === id) attachmentIds.add(item.attachmentId)
    }

    attachmentIds.forEach((attachmentId) => {
      abortAttachmentUpload(attachmentId)
      abortCanvasFetch(attachmentId)
    })

    uploadQueueState = {
      ...uploadQueueState,
      items: uploadQueueState.items.filter((item) => item.sessionId !== id),
    }

    // 关闭策略：不保留 uploading/失效预览草稿，避免 reopen 后发送门禁卡死
    clearSessionDraftAttachments(id)
  }

  function createAttachment(file: File, assetId?: string, nodeId?: string): ChatAttachment {
    // 已入库资源（画布回填）跳过本地文件白名单
    if (assetId) {
      const isImageMime = String(file.type || '').startsWith('image/')
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: isImageMime && file.size > 0 ? URL.createObjectURL(file) : '',
        fileName: file.name,
        assetId,
        nodeId,
        uploading: undefined,
      }
    }
    const allowed = validateChatImageFile(file)
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: allowed.ok ? URL.createObjectURL(file) : '',
      fileName: file.name,
      assetId,
      nodeId,
      uploading: allowed.ok ? true : undefined,
      uploadError: allowed.ok ? undefined : allowed.reason,
    }
  }

  function patchAttachment(id: string, patch: Partial<ChatAttachment>) {
    attachments.value = attachments.value.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    )
  }

  function findSessionAttachment(sessionId: string, attachmentId: string) {
    return findOwnedAttachmentTarget(
      sessionId,
      options.getActiveSessionId(),
      attachments.value,
      options.getSessionAttachments,
      attachmentId,
    )?.attachment
  }

  function patchSessionAttachment(
    sessionId: string,
    attachmentId: string,
    patch: Partial<ChatAttachment>,
  ): ChatAttachment | undefined {
    const target = findOwnedAttachmentTarget(
      sessionId,
      options.getActiveSessionId(),
      attachments.value,
      options.getSessionAttachments,
      attachmentId,
    )
    if (!target) return undefined

    if (target.isActiveSession) {
      patchAttachment(attachmentId, patch)
      options.saveActiveDraft()
      return { ...target.attachment, ...patch }
    }

    const index = target.attachments.findIndex((item) => item.id === attachmentId)
    target.attachments[index] = { ...target.attachment, ...patch }
    return target.attachments[index]
  }

  async function uploadAttachmentToOss(
    attachmentId: string,
    bound?: { sessionId: string; projectId: string },
  ) {
    const ownerSessionId = bound?.sessionId || options.ensureActiveSession().id
    const ownerProjectId = bound?.projectId ?? currentProjectId()
    // 捕获启动时 generation：invalidate 后旧任务不得继续上传
    const uploadGen = uploadQueueState.generation

    // 立即登记取消令牌，覆盖文件头校验等 await 窗口
    const previous = uploadAbortById.get(attachmentId)
    if (previous) previous.abort()
    const abort = new AbortController()
    uploadAbortById.set(attachmentId, abort)

    const isUploadStillValid = () => {
      if (abort.signal.aborted) return false
      if (uploadGen !== uploadQueueState.generation) return false
      if (ownerProjectId !== currentProjectId()) return false
      return Boolean(findSessionAttachment(ownerSessionId, attachmentId))
    }

    try {
      if (!isUploadStillValid()) return

      const attachment =
        findSessionAttachment(ownerSessionId, attachmentId) ||
        attachments.value.find((item) => item.id === attachmentId)
      if (!attachment) return

      const validation = validateChatImageFile(attachment.file)
      if (!validation.ok) {
        if (isUploadStillValid()) {
          patchSessionAttachment(ownerSessionId, attachmentId, {
            uploading: false,
            uploadError: validation.reason,
          })
        }
        return
      }

      const deep = await validateChatImageFileAsync(attachment.file)
      if (!isUploadStillValid()) return
      if (!deep.ok) {
        patchSessionAttachment(ownerSessionId, attachmentId, {
          uploading: false,
          uploadError: deep.reason,
        })
        return
      }

      patchSessionAttachment(ownerSessionId, attachmentId, {
        uploading: true,
        uploadError: undefined,
      })
      if (options.getActiveSessionId() === ownerSessionId) {
        options.saveActiveDraft()
      }

      const result = await uploadAssetFile(attachment.file, {
        projectId: ownerProjectId || undefined,
        signal: abort.signal,
      })
      if (!isUploadStillValid()) return

      const nextPreviewUrl = result.url || attachment.previewUrl
      const current = findSessionAttachment(ownerSessionId, attachmentId)
      if (!current) return

      const updated = patchSessionAttachment(ownerSessionId, attachmentId, {
        assetId: result.assetId,
        previewUrl: nextPreviewUrl,
        uploading: false,
        uploadError: undefined,
      })
      if (!updated) return

      // 确认所属会话中的附件已更新后再撤销旧 Blob URL，避免切换会话时缩略图失效
      if (result.url && attachment.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(attachment.previewUrl)
      }

      // 上传成功后插入画布，便于 agent 通过 nodeId 交互；已有 nodeId（如从画布加入）则跳过
      // 仅当仍是当前活动会话时插画布，避免串到其他会话上下文
      if (
        !updated.nodeId &&
        nextPreviewUrl &&
        options.getActiveSessionId() === ownerSessionId &&
        ownerProjectId === currentProjectId()
      ) {
        options.emitInsertImageToCanvas({
          attachmentId,
          assetId: result.assetId || undefined,
          previewUrl: nextPreviewUrl,
          fileName: updated.fileName,
          width: result.width,
          height: result.height,
        })
      }
    } catch (error) {
      if (abort.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        return
      }
      if (!isUploadStillValid()) return
      patchSessionAttachment(ownerSessionId, attachmentId, {
        uploading: false,
        uploadError: error instanceof Error ? error.message : '上传失败',
      })
    } finally {
      if (uploadAbortById.get(attachmentId) === abort) {
        uploadAbortById.delete(attachmentId)
      }
    }
  }

  function bindAttachmentNodeId(attachmentId: string, nodeId: string) {
    const id = attachmentId?.trim()
    const nextNodeId = nodeId?.trim()
    if (!id || !nextNodeId) return
    const target = attachments.value.find((item) => item.id === id)
    if (!target || target.nodeId === nextNodeId) return
    patchAttachment(id, { nodeId: nextNodeId })
  }

  function clearAssetMentions() {
    assetMentions.value = []
  }

  function removeAssetMention(id: string) {
    assetMentions.value = assetMentions.value.filter((item) => item.id !== id)
  }

  function insertAssetMention(payload: { id: string; role: string; name: string }) {
    if (assetMentions.value.some((item) => item.id === payload.id)) return
    assetMentions.value.push(payload)
  }

  function addAttachments(files: File[], assetId?: string, nodeId?: string) {
    const ownerSession = options.ensureActiveSession()
    const ownerSessionId = ownerSession.id
    const ownerProjectId = currentProjectId()
    const ownerEpoch = attachmentFetchEpoch
    const opGeneration = getSessionAttachOpGeneration(sessionAttachOpGen, ownerSessionId)

    // 画布回填（已有 assetId）同步写入 owner，不受本地批量白名单阻断
    if (assetId) {
      if (
        !isOwnedAddStillValid(
          {
            sessionId: ownerSessionId,
            projectId: ownerProjectId,
            epoch: ownerEpoch,
          },
          opGeneration,
        )
      ) {
        return
      }
      files.forEach((file) => {
        const attachment = createAttachment(file, assetId, nodeId)
        appendOwnerAttachment(ownerSessionId, attachment)
      })
      return
    }

    addAttachmentsChain = addAttachmentsChain
      .then(() =>
        runOwnedAddAttachments(files, {
          sessionId: ownerSessionId,
          projectId: ownerProjectId,
          epoch: ownerEpoch,
          opGeneration,
          nodeId,
        }),
      )
      .catch(() => {
        // 单次失败不阻断后续 drop
      })
  }

  async function runOwnedAddAttachments(
    files: File[],
    owner: {
      sessionId: string
      projectId: string
      epoch: number
      opGeneration: number
      nodeId?: string
    },
  ) {
    const ensureAddAllowed = (warnOnContextLoss: boolean) => {
      if (
        !isSessionAttachOpCurrent(sessionAttachOpGen, owner.sessionId, owner.opGeneration)
      ) {
        // 标签关闭 / 会话取消：静默丢弃，避免向已关闭草稿写入
        return false
      }
      if (!isOwnerContextValid(owner)) {
        if (warnOnContextLoss) message.warning('会话已切换，未添加图片')
        return false
      }
      return true
    }

    if (!ensureAddAllowed(true)) return

    const planned = planChatAttachmentBatch(files, getOwnerAttachmentCount(owner.sessionId))
    const accepted: File[] = []
    let rejectedReason = planned.rejectedReason

    for (const file of planned.accepted) {
      if (!ensureAddAllowed(true)) return
      const deep = await validateChatImageFileAsync(file)
      if (!ensureAddAllowed(false)) return
      if (!deep.ok) {
        rejectedReason = deep.reason
        continue
      }
      accepted.push(file)
    }

    if (!ensureAddAllowed(true)) return

    // 二次按 owner 当前数量截断，防止异步期间其他同步路径插入
    const room = Math.max(0, CHAT_ATTACHMENT_MAX_COUNT - getOwnerAttachmentCount(owner.sessionId))
    const toCommit = accepted.slice(0, room)
    if (accepted.length > toCommit.length) {
      rejectedReason = rejectedReason || `最多添加 ${CHAT_ATTACHMENT_MAX_COUNT} 张图片`
    }

    if (!toCommit.length) {
      if (rejectedReason) message.warning(rejectedReason)
      return
    }

    toCommit.forEach((file) => {
      if (!ensureAddAllowed(false)) return
      const attachment = createAttachment(file, undefined, owner.nodeId)
      if (!appendOwnerAttachment(owner.sessionId, attachment)) {
        rejectedReason = '会话草稿不可用，未添加图片'
        return
      }
      enqueueAttachmentUpload({
        attachmentId: attachment.id,
        sessionId: owner.sessionId,
        projectId: owner.projectId,
      })
    })

    if (!ensureAddAllowed(false)) return

    if (rejectedReason) {
      message.warning(
        toCommit.length < files.length ? `部分文件未添加：${rejectedReason}` : rejectedReason,
      )
    }
  }

  async function addAttachmentFromCanvas(payload: {
    previewUrl: string
    fileName: string
    assetId?: string
    nodeId?: string
  }) {
    if (!payload.previewUrl) return

    const ownerSession = options.ensureActiveSession()
    const ownerSessionId = ownerSession.id
    const ownerProjectId = currentProjectId()
    const ownerEpoch = attachmentFetchEpoch

    // 已存在相同资源时，仅聚焦输入框，避免重复添加；若缺少 nodeId 则补上
    const existing = attachments.value.find(
      (item) =>
        item.previewUrl === payload.previewUrl ||
        (payload.nodeId && item.nodeId === payload.nodeId) ||
        (payload.assetId && item.assetId === payload.assetId),
    )
    if (existing) {
      if (payload.nodeId && !existing.nodeId) {
        patchAttachment(existing.id, { nodeId: payload.nodeId })
      }
      if (payload.assetId && !existing.assetId) {
        patchAttachment(existing.id, { assetId: payload.assetId })
      }
      options.focusInput()
      return
    }

    const dedupeKey = buildCanvasFetchDedupeKey({
      ...payload,
      sessionId: ownerSessionId,
      projectId: ownerProjectId,
    })
    if (canvasFetchInflight.has(dedupeKey)) {
      options.focusInput()
      return
    }

    const fileName = payload.fileName || 'canvas-image.jpg'
    const assetId = payload.assetId || undefined
    const nodeId = payload.nodeId?.trim() || undefined
    const attachmentId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // 立刻在所属草稿创建占位，后续 await 后按 owner 回写，避免串会话
    const placeholder: ChatAttachment = {
      id: attachmentId,
      file: new File([], fileName, { type: 'image/jpeg' }),
      previewUrl: payload.previewUrl,
      fileName,
      assetId,
      nodeId,
      uploading: true,
    }
    attachments.value.push(placeholder)
    options.saveActiveDraft()
    options.focusInput()

    canvasFetchInflight.set(dedupeKey, attachmentId)
    const abort = new AbortController()
    canvasFetchAbortById.set(attachmentId, abort)

    const owner = {
      sessionId: ownerSessionId,
      projectId: ownerProjectId,
      epoch: ownerEpoch,
      attachmentId,
    }

    const fetchBlob = async (url: string) => {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: url.startsWith('/') ? 'same-origin' : 'omit',
        signal: abort.signal,
      })
      if (!response.ok) throw new Error(`fetch failed: ${response.status}`)
      return response.blob()
    }

    try {
      let blob: Blob | null = null
      try {
        blob = await fetchBlob(payload.previewUrl)
      } catch (directError) {
        if (abort.signal.aborted) return
        // 直连跨域失败时走同源 media-proxy 再拉一次
        const proxies = await mintMediaProxyCandidates(payload.previewUrl)
        if (!isFetchContextValid(owner)) return
        for (const proxyUrl of proxies) {
          if (abort.signal.aborted || !isFetchContextValid(owner)) return
          try {
            blob = await fetchBlob(proxyUrl)
            break
          } catch {
            // try next candidate
          }
        }
        if (!blob)
          throw directError instanceof Error ? directError : new Error('fetch image blob failed')
      }

      if (!isFetchContextValid(owner)) return
      if (!blob) throw new Error('fetch image blob failed')

      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })
      const updated = patchSessionAttachment(ownerSessionId, attachmentId, {
        file,
        previewUrl: URL.createObjectURL(file),
        uploading: !assetId,
        uploadError: undefined,
        assetId,
        nodeId,
      })
      if (!updated) return

      if (!assetId) {
        await uploadAttachmentToOss(attachmentId, {
          sessionId: ownerSessionId,
          projectId: ownerProjectId,
        })
      } else {
        patchSessionAttachment(ownerSessionId, attachmentId, { uploading: false })
      }
    } catch (error) {
      if (abort.signal.aborted || !isFetchContextValid(owner)) return
      console.warn('[ChatSidePanel] 拉取画布图片失败', error)
      if (assetId) {
        // 已有服务端 assetId，可直接随消息发送，无需本地文件内容
        patchSessionAttachment(ownerSessionId, attachmentId, {
          uploading: false,
          uploadError: undefined,
          assetId,
          nodeId,
        })
      } else {
        patchSessionAttachment(ownerSessionId, attachmentId, {
          uploading: false,
          uploadError: '图片拉取失败，请删除后重试',
        })
      }
    } finally {
      canvasFetchAbortById.delete(attachmentId)
      if (canvasFetchInflight.get(dedupeKey) === attachmentId) {
        canvasFetchInflight.delete(dedupeKey)
      }
    }
  }

  function addSkillFile(file: File, skillName?: string) {
    options.ensureActiveSession()
    if (!file.name.endsWith('.md')) return
    attachments.value.push(createAttachment(file))
    if (skillName) {
      options.setMessage(`请使用技能「${skillName}」处理以下工作流`)
    }
    options.focusInput()
  }

  function removeAttachment(id: string) {
    abortCanvasFetch(id)
    abortAttachmentUpload(id)
    const index = attachments.value.findIndex((item) => item.id === id)
    const target = index >= 0 ? attachments.value[index] : undefined
    if (target?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl)
    attachments.value = attachments.value.filter((item) => item.id !== id)
    if (index < 0) return
    // 同步移除文本中的 @图片N，并前移后续编号
    const prev = options.getMessage()
    const nextMessage = removeImageRefMentionFromPrompt(prev, index + 1)
    if (nextMessage !== prev) {
      options.setMessage(nextMessage)
    }
  }

  function clearAttachments() {
    attachments.value.forEach((item) => {
      abortCanvasFetch(item.id)
      abortAttachmentUpload(item.id)
      if (item.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl)
    })
    attachments.value = []
    const prev = options.getMessage()
    const nextMessage = stripAllImageRefMentionsFromPrompt(prev)
    if (nextMessage !== prev) {
      options.setMessage(nextMessage)
    }
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

  return {
    attachments,
    assetMentions,
    fileInputRef,
    createAttachment,
    patchAttachment,
    uploadAttachmentToOss,
    bindAttachmentNodeId,
    clearAssetMentions,
    removeAssetMention,
    insertAssetMention,
    addAttachments,
    addAttachmentFromCanvas,
    addSkillFile,
    removeAttachment,
    clearAttachments,
    invalidateAttachmentFetches,
    cancelSessionAttachments,
    openFilePicker,
    onFileInputChange,
    onComposerDrop,
  }
}
