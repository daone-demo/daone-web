/**
 * 聊天附件仅支持图片：MIME、扩展名须一致，并校验大小与文件头。
 * 拖拽不受 input accept 约束，须在状态层与上传前复用同一套校验。
 * 服务端仍须校验真实内容；前端字段不可信。
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

/** MIME → 允许扩展名（两侧同时存在时必须互相映射） */
export const CHAT_IMAGE_MIME_EXT_MAP: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/jpg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/bmp': ['bmp'],
  'image/heic': ['heic', 'heif'],
  'image/heif': ['heic', 'heif'],
}

/** 单张聊天图片上限：20MB */
export const CHAT_IMAGE_MAX_BYTES = 20 * 1024 * 1024
/** 单次添加最多张数（含已有附件合计） */
export const CHAT_ATTACHMENT_MAX_COUNT = 9
/** 单次添加总字节上限 */
export const CHAT_ATTACHMENT_MAX_BATCH_BYTES = 40 * 1024 * 1024
/** OSS 直传并发上限 */
export const CHAT_UPLOAD_MAX_CONCURRENCY = 3

export type ChatImageValidationResult =
  | { ok: true }
  | { ok: false; reason: string }

export function fileExtension(fileName: string): string {
  const base = String(fileName || '').trim().split(/[/\\]/).pop() || ''
  const dot = base.lastIndexOf('.')
  if (dot < 0) return ''
  return base.slice(dot + 1).toLowerCase()
}

/** 同步契约：MIME/扩展名/大小（不含文件头） */
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

  if (mime === 'image/svg+xml' || ext === 'svg') {
    return { ok: false, reason: '不支持 SVG 图片' }
  }
  if (mime && !mime.startsWith('image/')) {
    return { ok: false, reason: '仅支持上传图片文件' }
  }

  const mimeOk = mime ? CHAT_IMAGE_MIME_ALLOWLIST.has(mime) : false
  const extOk = ext ? CHAT_IMAGE_EXT_ALLOWLIST.has(ext) : false

  if (mime && ext) {
    // 两侧都存在：必须同时在白名单且互相映射
    if (!mimeOk || !extOk) {
      return { ok: false, reason: '仅支持上传图片文件' }
    }
    const mapped = CHAT_IMAGE_MIME_EXT_MAP[mime]
    if (!mapped || !mapped.includes(ext)) {
      return { ok: false, reason: '文件类型与扩展名不一致' }
    }
    return { ok: true }
  }

  if (!mime && ext) {
    // 空 MIME：仅允许受控扩展名（部分浏览器拖拽不带 type）
    if (!extOk) {
      return { ok: false, reason: '仅支持上传图片文件' }
    }
    return { ok: true }
  }

  if (mime && !ext) {
    if (!mimeOk) {
      return { ok: false, reason: '仅支持上传图片文件' }
    }
    return { ok: true }
  }

  return { ok: false, reason: '仅支持上传图片文件' }
}

function bytesMatch(header: Uint8Array, signature: number[], offset = 0): boolean {
  if (header.length < offset + signature.length) return false
  return signature.every((b, i) => header[offset + i] === b)
}

/** 文件头快速校验（用户反馈）；HEIC/HEIF 结构复杂，仅放行扩展名已通过的情况 */
export async function matchesChatImageMagic(file: File): Promise<boolean> {
  const ext = fileExtension(file.name)
  const mime = String(file.type || '')
    .trim()
    .toLowerCase()
  if (ext === 'heic' || ext === 'heif' || mime === 'image/heic' || mime === 'image/heif') {
    return true
  }

  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (bytesMatch(buf, [0xff, 0xd8, 0xff])) return true // JPEG
  if (bytesMatch(buf, [0x89, 0x50, 0x4e, 0x47])) return true // PNG
  if (bytesMatch(buf, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return true // GIF87a
  if (bytesMatch(buf, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return true // GIF89a
  if (bytesMatch(buf, [0x42, 0x4d])) return true // BMP
  // WEBP: RIFF....WEBP
  if (
    bytesMatch(buf, [0x52, 0x49, 0x46, 0x46]) &&
    bytesMatch(buf, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return true
  }
  return false
}

/** 完整校验：同步契约 + 文件头 */
export async function validateChatImageFileAsync(
  file: File,
): Promise<ChatImageValidationResult> {
  const basic = validateChatImageFile(file)
  if (!basic.ok) return basic
  try {
    const magicOk = await matchesChatImageMagic(file)
    if (!magicOk) {
      return { ok: false, reason: '文件内容不是有效图片' }
    }
  } catch {
    return { ok: false, reason: '无法读取文件内容' }
  }
  return { ok: true }
}

export type ChatAttachmentBatchPlan = {
  accepted: File[]
  rejectedReason?: string
}

/** 规划本批次可接受文件：数量 / 总大小 / 单文件校验（同步层） */
export function planChatAttachmentBatch(
  incoming: File[],
  currentCount: number,
  options?: { skipValidate?: boolean },
): ChatAttachmentBatchPlan {
  const accepted: File[] = []
  let batchBytes = 0
  let rejectedReason: string | undefined

  for (const file of incoming) {
    if (currentCount + accepted.length >= CHAT_ATTACHMENT_MAX_COUNT) {
      rejectedReason = `最多添加 ${CHAT_ATTACHMENT_MAX_COUNT} 张图片`
      break
    }
    if (!options?.skipValidate) {
      const check = validateChatImageFile(file)
      if (!check.ok) {
        rejectedReason = check.reason
        continue
      }
    }
    if (batchBytes + file.size > CHAT_ATTACHMENT_MAX_BATCH_BYTES) {
      rejectedReason = '单次添加图片总大小超限'
      continue
    }
    accepted.push(file)
    batchBytes += file.size
  }

  return { accepted, rejectedReason }
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
