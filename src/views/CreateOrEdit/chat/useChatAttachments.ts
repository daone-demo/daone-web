import { ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { mintMediaProxyCandidates } from '@/components/Canvas/mediaProxy'
import { uploadAssetFile } from '@/components/Canvas/upload'
import {
  removeImageRefMentionFromPrompt,
  stripAllImageRefMentionsFromPrompt,
} from '@/components/Canvas/promptMention'
import type { ChatAttachment } from '../chatTypes'
import { findOwnedAttachmentTarget } from './chatAttachmentOwner'

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
  focusInput: () => void
  saveActiveDraft: () => void
  getMessage: () => string
  setMessage: (message: string) => void
}

export function useChatAttachments(options: UseChatAttachmentsOptions) {
  const attachments = ref<ChatAttachment[]>([])
  const assetMentions = ref<Array<{ id: string; role: string; name: string }>>([])
  const fileInputRef = ref<HTMLInputElement | null>(null)

  function createAttachment(file: File, assetId?: string, nodeId?: string): ChatAttachment {
    const isImage = file.type.startsWith('image/')
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: isImage ? URL.createObjectURL(file) : '',
      fileName: file.name,
      assetId,
      nodeId,
      uploading: isImage && !assetId ? true : undefined,
    }
  }

  function patchAttachment(id: string, patch: Partial<ChatAttachment>) {
    attachments.value = attachments.value.map((item) =>
      (item.id === id ? { ...item, ...patch } : item),
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

  async function uploadAttachmentToOss(attachmentId: string) {
    const ownerSessionId = options.ensureActiveSession().id
    const attachment = attachments.value.find((item) => item.id === attachmentId)
    if (!attachment) return

    patchAttachment(attachmentId, { uploading: true, uploadError: undefined })
    options.saveActiveDraft()

    try {
      const result = await uploadAssetFile(attachment.file, { projectId: toValue(options.projectId) })
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
      if (!updated.nodeId && nextPreviewUrl) {
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
      patchSessionAttachment(ownerSessionId, attachmentId, {
        uploading: false,
        uploadError: error instanceof Error ? error.message : '上传失败',
      })
    }
  }

  function bindAttachmentNodeId(attachmentId: string, nodeId: string) {
    const id = attachmentId?.trim()
    const nextNodeId = nodeId?.trim()
    if (!id || !nextNodeId) return
    const target = attachments.value.find((item) => item.id === id)
    if (!target || target.nodeId === nextNodeId) return
    patchAttachment(id, { nodeId: nextNodeId })
    options.saveActiveDraft()
  }

  function clearAssetMentions() {
    assetMentions.value = []
  }

  function removeAssetMention(id: string) {
    assetMentions.value = assetMentions.value.filter((item) => item.id !== id)
  }

  function insertAssetMention(payload: { id: string; role: string; name: string }) {
    options.ensureActiveSession()
    if (assetMentions.value.some((item) => item.id === payload.id)) {
      options.focusInput()
      return
    }
    assetMentions.value = [...assetMentions.value, payload]
    options.focusInput()
  }

  function addAttachments(files: File[], assetId?: string, nodeId?: string) {
    options.ensureActiveSession()
    files.forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const attachment = createAttachment(file, assetId, nodeId)
      attachments.value.push(attachment)
      if (!assetId) {
        void uploadAttachmentToOss(attachment.id)
      }
    })
  }

  async function addAttachmentFromCanvas(payload: {
    previewUrl: string
    fileName: string
    assetId?: string
    nodeId?: string
  }) {
    options.ensureActiveSession()
    if (!payload.previewUrl) return

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

    const fileName = payload.fileName || 'canvas-image.jpg'
    const assetId = payload.assetId || undefined
    const nodeId = payload.nodeId?.trim() || undefined

    const fetchBlob = async (url: string) => {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: url.startsWith('/') ? 'same-origin' : 'omit',
      })
      if (!response.ok) throw new Error(`fetch failed: ${response.status}`)
      return response.blob()
    }

    try {
      let blob: Blob | null = null
      try {
        blob = await fetchBlob(payload.previewUrl)
      } catch {
        // 直连跨域失败时走同源 media-proxy 再拉一次
        const proxies = await mintMediaProxyCandidates(payload.previewUrl)
        for (const proxyUrl of proxies) {
          try {
            blob = await fetchBlob(proxyUrl)
            break
          } catch {
            // try next candidate
          }
        }
      }
      if (!blob) throw new Error('fetch image blob failed')

      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })
      addAttachments([file], assetId, nodeId)
    } catch (error) {
      console.warn('[ChatSidePanel] 拉取画布图片失败', error)
      if (assetId) {
        // 已有服务端 assetId，可直接随消息发送，无需本地文件内容
        attachments.value.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: new File([], fileName, { type: 'image/jpeg' }),
          previewUrl: payload.previewUrl,
          fileName,
          assetId,
          nodeId,
        })
      } else {
        // 无 assetId 且拉流失败：标记错误，禁止误发送空附件
        attachments.value.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: new File([], fileName, { type: 'image/jpeg' }),
          previewUrl: payload.previewUrl,
          fileName,
          nodeId,
          uploadError: '图片拉取失败，请删除后重试',
        })
      }
    }

    options.focusInput()
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
    const index = attachments.value.findIndex((item) => item.id === id)
    const target = index >= 0 ? attachments.value[index] : undefined
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
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
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
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
    openFilePicker,
    onFileInputChange,
    onComposerDrop,
  }
}
