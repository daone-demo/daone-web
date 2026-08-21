/**
 * 聊天附件校验契约测试。
 * 运行：node --experimental-strip-types --test scripts/chat-attachment-validate.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CHAT_ATTACHMENT_MAX_COUNT,
  CHAT_UPLOAD_MAX_CONCURRENCY,
  isChatAttachmentSendReady,
  planChatAttachmentBatch,
  validateChatImageFile,
  validateChatImageFileAsync,
} from '../src/views/CreateOrEdit/chat/chatAttachmentValidate.ts'

function makeFile(name: string, type: string, size = 1024, content?: Uint8Array) {
  const buf = content ?? new Uint8Array(Math.max(0, size))
  if (!content && size > 0) {
    // 默认塞入 PNG 头，便于 magic 测试
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    for (let i = 0; i < png.length && i < buf.length; i++) buf[i] = png[i]
  }
  return new File([buf], name, { type })
}

test('拒绝非图片 MIME / 扩展名 / 空文件 / 超限 / SVG', () => {
  assert.equal(validateChatImageFile(makeFile('a.pdf', 'application/pdf')).ok, false)
  assert.equal(validateChatImageFile(makeFile('a.zip', 'application/zip')).ok, false)
  assert.equal(validateChatImageFile(makeFile('a.exe', '')).ok, false)
  assert.equal(validateChatImageFile(makeFile('a.png', 'image/png', 0)).ok, false)
  assert.equal(
    validateChatImageFile(makeFile('a.png', 'image/png', 21 * 1024 * 1024)).ok,
    false,
  )
  assert.equal(validateChatImageFile(makeFile('a.svg', 'image/svg+xml')).ok, false)
})

test('伪装 MIME/扩展名必须同时拒绝', () => {
  assert.equal(
    validateChatImageFile(makeFile('payload.exe', 'image/png')).ok,
    false,
    '允许 MIME + 非法扩展名应拒绝',
  )
  assert.equal(
    validateChatImageFile(makeFile('payload.pdf', 'image/jpeg')).ok,
    false,
    '允许 MIME + 非法扩展名应拒绝',
  )
  assert.equal(
    validateChatImageFile(makeFile('photo.png', 'application/octet-stream')).ok,
    false,
    '允许扩展名 + 非法 MIME 应拒绝',
  )
  assert.equal(
    validateChatImageFile(makeFile('photo.jpg', 'image/png')).ok,
    false,
    'MIME/扩展名映射不一致应拒绝',
  )
})

test('允许常见图片；空 MIME 时靠受控扩展名', () => {
  assert.equal(validateChatImageFile(makeFile('a.png', 'image/png')).ok, true)
  assert.equal(validateChatImageFile(makeFile('a.JPG', '')).ok, true)
  assert.equal(validateChatImageFile(makeFile('a.webp', 'image/webp')).ok, true)
})

test('文件头与声明类型不匹配时异步校验失败', async () => {
  const fakePng = makeFile('a.png', 'image/png', 64, new Uint8Array(64).fill(0))
  const result = await validateChatImageFileAsync(fakePng)
  assert.equal(result.ok, false)
})

test('批量规划：数量与总大小上限', () => {
  const files = Array.from({ length: CHAT_ATTACHMENT_MAX_COUNT + 2 }, (_, i) =>
    makeFile(`a${i}.png`, 'image/png', 1024),
  )
  const planned = planChatAttachmentBatch(files, 0)
  assert.equal(planned.accepted.length, CHAT_ATTACHMENT_MAX_COUNT)
  assert.match(String(planned.rejectedReason), /最多添加/)

  const huge = Array.from({ length: 3 }, (_, i) =>
    makeFile(`b${i}.png`, 'image/png', 15 * 1024 * 1024),
  )
  const plannedHuge = planChatAttachmentBatch(huge, 0)
  assert.ok(plannedHuge.accepted.length < huge.length)
  assert.match(String(plannedHuge.rejectedReason), /总大小/)
})

test('并发上限常量受控', () => {
  assert.ok(CHAT_UPLOAD_MAX_CONCURRENCY >= 1 && CHAT_UPLOAD_MAX_CONCURRENCY <= 5)
})

test('发送就绪要求 assetId 且非上传中/无错误', () => {
  const base = {
    id: '1',
    file: makeFile('a.png', 'image/png'),
    previewUrl: 'blob:x',
    fileName: 'a.png',
  }
  assert.equal(isChatAttachmentSendReady({ ...base, uploading: true }), false)
  assert.equal(isChatAttachmentSendReady({ ...base, uploadError: 'fail' }), false)
  assert.equal(isChatAttachmentSendReady({ ...base }), false)
  assert.equal(isChatAttachmentSendReady({ ...base, assetId: 'asset-1' }), true)
})
