/**
 * 聊天附件校验 / 队列契约测试。
 * 运行：node --experimental-strip-types --test scripts/chat-attachment-validate.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CHAT_ATTACHMENT_MAX_COUNT,
  CHAT_UPLOAD_MAX_CONCURRENCY,
  detectChatImageMagic,
  isChatAttachmentSendReady,
  magicMatchesDeclaration,
  planChatAttachmentBatch,
  validateChatImageFile,
  validateChatImageFileAsync,
} from '../src/views/CreateOrEdit/chat/chatAttachmentValidate.ts'
import {
  bumpUploadQueueGeneration,
  completeChatUploadSlot,
  createChatUploadQueueState,
  enqueueChatUpload,
  pumpChatUploadQueue,
} from '../src/views/CreateOrEdit/chat/chatAttachmentUploadQueue.ts'

function makeFile(name: string, type: string, size = 1024, content?: Uint8Array) {
  const buf = content ?? new Uint8Array(Math.max(0, size))
  if (!content && size > 0) {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    for (let i = 0; i < png.length && i < buf.length; i++) buf[i] = png[i]
  }
  return new File([buf], name, { type })
}

function jpegHeader(size = 64) {
  const buf = new Uint8Array(size)
  buf[0] = 0xff
  buf[1] = 0xd8
  buf[2] = 0xff
  return buf
}

function heicFtyp(brand = 'heic') {
  const buf = new Uint8Array(24)
  buf[0] = 0
  buf[1] = 0
  buf[2] = 0
  buf[3] = 24
  buf.set([0x66, 0x74, 0x79, 0x70], 4) // ftyp
  buf.set(
    Array.from(brand).map((c) => c.charCodeAt(0)),
    8,
  )
  return buf
}

test('拒绝非图片 MIME / 扩展名 / 空文件 / 超限 / SVG', () => {
  assert.equal(validateChatImageFile(makeFile('a.pdf', 'application/pdf')).ok, false)
  assert.equal(validateChatImageFile(makeFile('a.zip', 'application/zip')).ok, false)
  assert.equal(validateChatImageFile(makeFile('a.exe', '')).ok, false)
  assert.equal(validateChatImageFile(makeFile('a.png', 'image/png', 0)).ok, false)
  assert.equal(validateChatImageFile(makeFile('a.png', 'image/png', 21 * 1024 * 1024)).ok, false)
  assert.equal(validateChatImageFile(makeFile('a.svg', 'image/svg+xml')).ok, false)
})

test('伪装 MIME/扩展名必须同时拒绝', () => {
  assert.equal(validateChatImageFile(makeFile('payload.exe', 'image/png')).ok, false)
  assert.equal(validateChatImageFile(makeFile('payload.pdf', 'image/jpeg')).ok, false)
  assert.equal(validateChatImageFile(makeFile('photo.png', 'application/octet-stream')).ok, false)
  assert.equal(validateChatImageFile(makeFile('photo.jpg', 'image/png')).ok, false)
})

test('交叉图片签名：PNG 头配 jpeg 声明应失败', async () => {
  const crossed = makeFile('a.jpg', 'image/jpeg', 64) // default content is PNG header
  assert.equal(await detectChatImageMagic(crossed), 'png')
  assert.equal(magicMatchesDeclaration('png', 'image/jpeg', 'jpg'), false)
  const result = await validateChatImageFileAsync(crossed)
  assert.equal(result.ok, false)
  assert.match(String(result.ok ? '' : result.reason), /不一致|不是有效/)
})

test('JPEG 头配 jpeg 声明通过；HEIC 需 ftyp brand', async () => {
  const jpeg = makeFile('a.jpg', 'image/jpeg', 64, jpegHeader())
  assert.equal(await detectChatImageMagic(jpeg), 'jpeg')
  assert.equal((await validateChatImageFileAsync(jpeg)).ok, true)

  const fakeHeic = makeFile('a.heic', 'image/heic', 64, new Uint8Array(64).fill(1))
  assert.equal(await detectChatImageMagic(fakeHeic), null)
  assert.equal((await validateChatImageFileAsync(fakeHeic)).ok, false)

  const realHeic = makeFile('a.heic', 'image/heic', 64, heicFtyp('heic'))
  assert.equal(await detectChatImageMagic(realHeic), 'heic')
  assert.equal((await validateChatImageFileAsync(realHeic)).ok, true)
})

test('允许常见图片；空 MIME 时靠受控扩展名', () => {
  assert.equal(validateChatImageFile(makeFile('a.png', 'image/png')).ok, true)
  assert.equal(validateChatImageFile(makeFile('a.JPG', '')).ok, true)
  assert.equal(validateChatImageFile(makeFile('a.webp', 'image/webp')).ok, true)
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

test('超过 3 张时队列按并发泵出，切换 generation 后旧 complete 不改计数', () => {
  let state = createChatUploadQueueState()
  const present = new Set<string>()
  for (let i = 0; i < 6; i++) {
    const id = `att-${i}`
    present.add(id)
    state = enqueueChatUpload(state, {
      attachmentId: id,
      sessionId: 's1',
      projectId: 'p1',
    })
  }

  const first = pumpChatUploadQueue(
    state,
    (item) => present.has(item.attachmentId),
    CHAT_UPLOAD_MAX_CONCURRENCY,
  )
  assert.equal(first.started.length, CHAT_UPLOAD_MAX_CONCURRENCY)
  assert.equal(first.state.activeCount, CHAT_UPLOAD_MAX_CONCURRENCY)
  assert.equal(first.state.items.length, 6 - CHAT_UPLOAD_MAX_CONCURRENCY)

  // 模拟会话切换：bump generation，旧 finally 不得改写
  const bumped = bumpUploadQueueGeneration(first.state)
  assert.equal(bumped.activeCount, 0)
  assert.equal(bumped.items.length, 0)
  const stale = completeChatUploadSlot(bumped, first.state.generation)
  assert.equal(stale.activeCount, 0)
  assert.equal(stale.generation, bumped.generation)

  // 旧 session 附件仍可由 hasAttachment(session) 找到；当前活动数组缺失不得丢弃
  let otherSessionState = createChatUploadQueueState()
  otherSessionState = enqueueChatUpload(otherSessionState, {
    attachmentId: 'old-1',
    sessionId: 'session-A',
    projectId: 'p1',
  })
  const pumpedOther = pumpChatUploadQueue(
    otherSessionState,
    (item) => item.sessionId === 'session-A',
    CHAT_UPLOAD_MAX_CONCURRENCY,
  )
  assert.equal(pumpedOther.started.length, 1)
  assert.equal(pumpedOther.started[0]?.sessionId, 'session-A')
})

test('双 drop 串行规划：第二次基于更新后数量，不会双双吃满 9', () => {
  const first = planChatAttachmentBatch(
    Array.from({ length: 6 }, (_, i) => makeFile(`a${i}.png`, 'image/png')),
    0,
  )
  assert.equal(first.accepted.length, 6)
  const second = planChatAttachmentBatch(
    Array.from({ length: 6 }, (_, i) => makeFile(`b${i}.png`, 'image/png')),
    first.accepted.length,
  )
  assert.equal(second.accepted.length, CHAT_ATTACHMENT_MAX_COUNT - 6)
  assert.match(String(second.rejectedReason), /最多添加/)
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
