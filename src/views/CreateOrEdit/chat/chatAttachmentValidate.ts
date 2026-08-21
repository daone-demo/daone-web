/**
 * 聊天附件仅支持图片：MIME、扩展名与大小白名单。
 * 拖拽不受 input accept 约束，须在状态层与上传前复用同一套校验。
 */
import type { ChatAttachment } from '../chatTypes'

/** 与常见浏览器 image/* 对齐，排除 svg（可含脚本） */
export const CHAT_IMAGE_MIME_ALLOWLIST = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/heic',
  'image/heif',
])

export const CHAT_IMAGE_EXT_ALLOWLIST = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'heic',
  'heif',
])

/** 单张聊天图片上限：20MB */
export const CHAT_IMAGE_MAX_BYTES = 20 * 1024 * 1024

export type ChatImageValidationResult =
  | { ok: true }
  | { ok: false; reason: string }

function fileExtension(fileName: string): string {
  const base = String(fileName || '').trim().split(/[/\\]/).pop() || ''
  const dot = base.lastIndexOf('.')
  if (dot < 0) return ''
  return base.slice(dot + 1).toLowerCase()
}

export function validateChatImageFile(file: File): ChatImageValidationResult {
  if (!file || !(file instanceof File)) {
    return { ok: false, reason: '无效文件' }
  }
  if (!file.size || file.size <= 0) {
    return { ok: false, reason: '文件为空' }
  }
  if (file.size > CHAT_IMAGE_MAX_BYTES) {
    return { ok: false, reason: '图片不能超过 20MB' }
  }

  const mime = String(file.type || '')
    .trim()
    .toLowerCase()
  const ext = fileExtension(file.name)
  const mimeOk = mime ? CHAT_IMAGE_MIME_ALLOWLIST.has(mime) : false
  const extOk = ext ? CHAT_IMAGE_EXT_ALLOWLIST.has(ext) : false

  // MIME 与扩展名至少一侧命中；空 MIME 时必须靠扩展名
  if (!mimeOk && !extOk) {
    return { ok: false, reason: '仅支持上传图片文件' }
  }
  if (mime && !mime.startsWith('image/')) {
    return { ok: false, reason: '仅支持上传图片文件' }
  }
  if (mime === 'image/svg+xml') {
    return { ok: false, reason: '不支持 SVG 图片' }
  }

  return { ok: true }
}

/** 发送门禁：必须是已上传成功的图片附件（有 assetId、无错误、非上传中） */
export function isChatAttachmentSendReady(item: ChatAttachment): boolean {
  const file = item.file
  if (file && file.size > 0) {
    const check = validateChatImageFile(file)
    if (!check.ok) return false
  } else {
    // 画布拉取的占位附件：无真实文件内容时，仍要求有效 assetId
    const name = String(item.fileName || file?.name || '')
    const ext = fileExtension(name)
    if (ext && !CHAT_IMAGE_EXT_ALLOWLIST.has(ext)) return false
  }
  if (item.uploading) return false
  if (item.uploadError) return false
  return Boolean(String(item.assetId ?? '').trim())
}
