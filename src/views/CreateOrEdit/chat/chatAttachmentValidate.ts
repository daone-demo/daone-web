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

export type ChatImageMagicKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | 'heic' | 'heif'

/** magic 识别结果 ↔ 声明 MIME / 扩展名 */
export const CHAT_IMAGE_MAGIC_DECLARE_MAP: Record<
  ChatImageMagicKind,
  { mimes: readonly string[]; exts: readonly string[] }
> = {
  jpeg: { mimes: ['image/jpeg', 'image/jpg'], exts: ['jpg', 'jpeg'] },
  png: { mimes: ['image/png'], exts: ['png'] },
  gif: { mimes: ['image/gif'], exts: ['gif'] },
  webp: { mimes: ['image/webp'], exts: ['webp'] },
  bmp: { mimes: ['image/bmp'], exts: ['bmp'] },
  heic: { mimes: ['image/heic', 'image/heif'], exts: ['heic', 'heif'] },
  heif: { mimes: ['image/heic', 'image/heif'], exts: ['heic', 'heif'] },
}

const HEIC_FTYP_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
])

/** 单张聊天图片上限：20MB */
export const CHAT_IMAGE_MAX_BYTES = 20 * 1024 * 1024
/** 单次添加最多张数（含已有附件合计） */
export const CHAT_ATTACHMENT_MAX_COUNT = 9
/** 单次添加总字节上限 */
export const CHAT_ATTACHMENT_MAX_BATCH_BYTES = 40 * 1024 * 1024
/** OSS 直传并发上限 */
export const CHAT_UPLOAD_MAX_CONCURRENCY = 3

export type ChatImageValidationResult =
  { ok: true; magicKind?: ChatImageMagicKind } | { ok: false; reason: string }

export function fileExtension(fileName: string): string {
  const base =
    String(fileName || '')
      .trim()
      .split(/[/\\]/)
      .pop() || ''
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

function readFourCc(buf: Uint8Array, offset: number): string {
  if (buf.length < offset + 4) return ''
  return String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3])
}

/** 从文件头识别实际图片类型；无法识别返回 null */
export async function detectChatImageMagic(file: File): Promise<ChatImageMagicKind | null> {
  const buf = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  if (bytesMatch(buf, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (bytesMatch(buf, [0x89, 0x50, 0x4e, 0x47])) return 'png'
  if (bytesMatch(buf, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return 'gif'
  if (bytesMatch(buf, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return 'gif'
  if (bytesMatch(buf, [0x42, 0x4d])) return 'bmp'
  if (bytesMatch(buf, [0x52, 0x49, 0x46, 0x46]) && bytesMatch(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp'
  }

  // ISO BMFF：size(4) + 'ftyp'(4) + major_brand(4) + ... compatible brands
  if (buf.length >= 12 && readFourCc(buf, 4) === 'ftyp') {
    const brands: string[] = [readFourCc(buf, 8)]
    for (let i = 16; i + 4 <= buf.length; i += 4) {
      brands.push(readFourCc(buf, i))
    }
    const hit = brands.find((b) => HEIC_FTYP_BRANDS.has(b))
    if (hit) {
      if (hit.startsWith('hei') || hit === 'hevc' || hit === 'hevx') return 'heic'
      return 'heif'
    }
  }

  return null
}

/** magic 种类必须与声明 MIME/扩展名映射一致 */
export function magicMatchesDeclaration(
  kind: ChatImageMagicKind,
  mime: string,
  ext: string,
): boolean {
  const entry = CHAT_IMAGE_MAGIC_DECLARE_MAP[kind]
  if (!entry) return false
  if (mime && !entry.mimes.includes(mime)) return false
  if (ext && !entry.exts.includes(ext)) return false
  if (!mime && !ext) return false
  return true
}

/** @deprecated 使用 detectChatImageMagic；保留布尔包装兼容旧调用 */
export async function matchesChatImageMagic(file: File): Promise<boolean> {
  return (await detectChatImageMagic(file)) != null
}

/** 完整校验：同步契约 + 文件头类型与声明一致 */
export async function validateChatImageFileAsync(file: File): Promise<ChatImageValidationResult> {
  const basic = validateChatImageFile(file)
  if (!basic.ok) return basic
  const mime = String(file.type || '')
    .trim()
    .toLowerCase()
  const ext = fileExtension(file.name)
  try {
    const kind = await detectChatImageMagic(file)
    if (!kind) {
      return { ok: false, reason: '文件内容不是有效图片' }
    }
    if (!magicMatchesDeclaration(kind, mime, ext)) {
      return { ok: false, reason: '文件内容与声明类型不一致' }
    }
    return { ok: true, magicKind: kind }
  } catch {
    return { ok: false, reason: '无法读取文件内容' }
  }
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
    const name = String(item.fileName || file?.name || '')
    const ext = fileExtension(name)
    if (ext && !CHAT_IMAGE_EXT_ALLOWLIST.has(ext)) return false
  }
  if (item.uploading) return false
  if (item.uploadError) return false
  return Boolean(String(item.assetId ?? '').trim())
}
