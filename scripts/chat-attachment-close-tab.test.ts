/**
 * 关闭标签：作废预提交链、清空附件、同步清理 @图片N。
 * 运行：node --experimental-strip-types --test scripts/chat-attachment-close-tab.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bumpSessionAttachOpGeneration,
  getSessionAttachOpGeneration,
  isSessionAttachOpCurrent,
} from '../src/views/CreateOrEdit/chat/chatAttachmentSessionOps.ts'
import {
  clearSessionDraftAttachmentsState,
  stripSessionDraftImageMentions,
} from '../src/views/CreateOrEdit/chat/chatAttachmentDraftClear.ts'
import { stripAllImageRefMentionsFromPrompt } from '../src/components/Canvas/promptMention.ts'
import type { ChatAttachment } from '../src/views/CreateOrEdit/chatTypes.ts'

test('drop 后立即 close：bump generation 后旧 add 链判定失效', () => {
  const map = new Map<string, number>()
  const sessionId = 'session-A'
  const captured = getSessionAttachOpGeneration(map, sessionId)
  assert.equal(isSessionAttachOpCurrent(map, sessionId, captured), true)
  bumpSessionAttachOpGeneration(map, sessionId)
  assert.equal(
    isSessionAttachOpCurrent(map, sessionId, captured),
    false,
    '关闭后旧校验链不得继续写入草稿',
  )
})

test('活动会话 clear：清空附件、释放 Blob、strip @图片N，并 saveActiveDraft', () => {
  const revoked: string[] = []
  const aborted: string[] = []
  let saved = 0
  let message = '请参考 @图片1 继续'
  const attachments: ChatAttachment[] = [
    {
      id: 'att-1',
      file: new File([], 'a.png', { type: 'image/png' }),
      previewUrl: 'blob:active-preview',
      fileName: 'a.png',
      uploading: true,
    },
  ]
  const draft = {
    message,
    attachments: [...attachments],
  }

  clearSessionDraftAttachmentsState({
    sessionId: 'session-active',
    isActive: true,
    attachments,
    getActiveSessionId: () => 'session-active',
    getMessage: () => message,
    setMessage: (next) => {
      message = next
    },
    stripImageMentions: stripAllImageRefMentionsFromPrompt,
    saveActiveDraft: () => {
      saved += 1
      draft.message = message
      draft.attachments = [...attachments]
    },
    revokeObjectURL: (url) => {
      revoked.push(url)
    },
    onAbortAttachment: (id) => {
      aborted.push(id)
    },
  })

  assert.equal(attachments.length, 0)
  assert.equal(message.includes('@图片'), false)
  assert.equal(draft.attachments.length, 0)
  assert.equal(draft.message.includes('@图片'), false)
  assert.equal(saved, 1)
  assert.deepEqual(revoked, ['blob:active-preview'])
  assert.deepEqual(aborted, ['att-1'])
})

test('非活动会话 clear：只清该会话草稿与 mention，不影响活动会话', () => {
  let activeMessage = '活动 @图片1'
  const inactiveDraft = {
    message: '历史 @图片1 请继续',
    attachments: [
      {
        id: 'att-idle',
        file: new File([], 'idle.png', { type: 'image/png' }),
        previewUrl: 'blob:idle',
        fileName: 'idle.png',
        uploading: true,
      },
    ] as ChatAttachment[],
  }
  const activeAttachments: ChatAttachment[] = [
    {
      id: 'att-active',
      file: new File([], 'active.png', { type: 'image/png' }),
      previewUrl: 'blob:active',
      fileName: 'active.png',
    },
  ]

  clearSessionDraftAttachmentsState({
    sessionId: 'session-idle',
    isActive: false,
    attachments: activeAttachments,
    inactiveDraftAttachments: inactiveDraft.attachments,
    getActiveSessionId: () => 'session-active',
    getMessage: () => activeMessage,
    setMessage: (next) => {
      activeMessage = next
    },
    getSessionDraftMessage: (id) => (id === 'session-idle' ? inactiveDraft.message : undefined),
    setSessionDraftMessage: (id, next) => {
      if (id === 'session-idle') inactiveDraft.message = next
    },
    stripImageMentions: stripAllImageRefMentionsFromPrompt,
  })

  assert.equal(inactiveDraft.attachments.length, 0)
  assert.equal(inactiveDraft.message.includes('@图片'), false)
  assert.equal(activeAttachments.length, 1)
  assert.equal(activeMessage, '活动 @图片1')
})

test('close/reopen 一致性：message 与 attachments 同时干净', () => {
  // 复刻 closeTab：cancel 清草稿 + 兜底 strip + reopen 加载 draft
  let message = '看看 @图片1'
  const draft = {
    message,
    attachments: [
      {
        id: 'att-1',
        file: new File([], 'a.png', { type: 'image/png' }),
        previewUrl: 'blob:x',
        fileName: 'a.png',
        uploading: true,
      },
    ] as ChatAttachment[],
  }

  const opGen = new Map<string, number>()
  const captured = getSessionAttachOpGeneration(opGen, 'session-1')
  bumpSessionAttachOpGeneration(opGen, 'session-1')

  clearSessionDraftAttachmentsState({
    sessionId: 'session-1',
    isActive: true,
    attachments: draft.attachments,
    getActiveSessionId: () => 'session-1',
    getMessage: () => message,
    setMessage: (next) => {
      message = next
    },
    stripImageMentions: stripAllImageRefMentionsFromPrompt,
    saveActiveDraft: () => {
      draft.message = message
    },
  })
  draft.attachments = []
  draft.message = stripAllImageRefMentionsFromPrompt(draft.message || '')

  // reopen：复用同一 session 对象
  const reopenedMessage = draft.message
  const reopenedAttachments = draft.attachments
  assert.equal(isSessionAttachOpCurrent(opGen, 'session-1', captured), false)
  assert.equal(reopenedAttachments.length, 0)
  assert.equal(reopenedMessage.includes('@图片'), false)
  assert.equal(
    reopenedAttachments.some((item) => item.uploading),
    false,
  )
})

test('deferred 校验窗口：cancel bump 后旧 generation 不可提交', async () => {
  const map = new Map<string, number>()
  const sessionId = 'session-deferred'
  const ownerGen = getSessionAttachOpGeneration(map, sessionId)

  // 模拟 await validateChatImageFileAsync 期间 close
  const validateGate = Promise.resolve()
  bumpSessionAttachOpGeneration(map, sessionId)
  await validateGate

  assert.equal(isSessionAttachOpCurrent(map, sessionId, ownerGen), false)

  // 若仍允许提交则会 append；此处断言门禁为 false，等价于 runOwnedAddAttachments 提前 return
  const wouldAppend = isSessionAttachOpCurrent(map, sessionId, ownerGen)
  const draft: ChatAttachment[] = []
  if (wouldAppend) {
    draft.push({
      id: 'should-not',
      file: new File([], 'x.png', { type: 'image/png' }),
      previewUrl: '',
      fileName: 'x.png',
    })
  }
  assert.equal(draft.length, 0)
})

test('stripSessionDraftImageMentions：活动 / 非活动分支', () => {
  let active = 'hello @图片2'
  let idle = 'idle @图片3'
  stripSessionDraftImageMentions('active', {
    getActiveSessionId: () => 'active',
    getMessage: () => active,
    setMessage: (next) => {
      active = next
    },
    stripImageMentions: stripAllImageRefMentionsFromPrompt,
  })
  stripSessionDraftImageMentions('idle', {
    getActiveSessionId: () => 'active',
    getMessage: () => active,
    setMessage: (next) => {
      active = next
    },
    getSessionDraftMessage: () => idle,
    setSessionDraftMessage: (_id, next) => {
      idle = next
    },
    stripImageMentions: stripAllImageRefMentionsFromPrompt,
  })
  assert.equal(active.includes('@图片'), false)
  assert.equal(idle.includes('@图片'), false)
})
