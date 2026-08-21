/**
 * 聊天附件图片白名单与发送就绪门禁。
 * 运行：node --experimental-strip-types --test scripts/chat-attachment-validate.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isChatAttachmentSendReady,
  validateChatImageFile,
} from '../src/views/CreateOrEdit/chat/chatAttachmentValidate.ts'

function makeFile(name: string, type: string, size = 1024) {
  const buf = new Uint8Array(Math.max(0, size))
  return new File([buf], name, { type })
}

test('拒绝非图片 MIME / 扩展名 / 空文件 / 超限', () => {
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

test('允许常见图片；空 MIME 时靠扩展名', () => {
  assert.equal(validateChatImageFile(makeFile('a.png', 'image/png')).ok, true)
  assert.equal(validateChatImageFile(makeFile('a.JPG', '')).ok, true)
  assert.equal(validateChatImageFile(makeFile('a.webp', 'image/webp')).ok, true)
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
