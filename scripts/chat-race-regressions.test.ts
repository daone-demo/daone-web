import assert from 'node:assert/strict'
import test from 'node:test'
import { useSSE } from '../src/hooks/useSSE.ts'
import { findOwnedAttachmentTarget } from '../src/views/CreateOrEdit/chat/chatAttachmentOwner.ts'
import type { ChatAttachment } from '../src/views/CreateOrEdit/chatTypes.ts'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

test('旧 SSE 连接结束时不会中止新连接', async () => {
  const originalFetch = globalThis.fetch
  const signals: AbortSignal[] = []
  let activeStream: ReadableStreamDefaultController<Uint8Array> | undefined

  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal as AbortSignal
    signals.push(signal)

    if (signals.length === 1) {
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          queueMicrotask(() => reject(new DOMException('Aborted', 'AbortError')))
        }, { once: true })
      })
    }

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        activeStream = controller
        signal.addEventListener('abort', () => {
          controller.error(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      },
    })
    return Promise.resolve(new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }))
  }) as typeof fetch

  try {
    const sse = useSSE()
    const oldConnection = sse.connect({ url: '/old' })
    const newConnection = sse.connect({ url: '/new' })

    await tick()
    await tick()

    assert.equal(signals.length, 2)
    assert.equal(signals[0].aborted, true)
    assert.equal(signals[1].aborted, false)
    assert.equal(sse.connected.value, true)

    sse.close()
    activeStream = undefined
    await Promise.allSettled([oldConnection, newConnection])
  } finally {
    globalThis.fetch = originalFetch
    activeStream = undefined
  }
})

test('附件上传完成后按所属会话查找，不写入当前新会话', () => {
  const oldAttachment = {
    id: 'attachment-old',
    previewUrl: 'blob:old',
    fileName: 'old.png',
    uploading: true,
  } as ChatAttachment
  const newAttachment = {
    id: 'attachment-new',
    previewUrl: 'blob:new',
    fileName: 'new.png',
  } as ChatAttachment

  const oldDraft = [oldAttachment]
  const activeAttachments = [newAttachment]
  const target = findOwnedAttachmentTarget(
    'session-old',
    'session-new',
    activeAttachments,
    (sessionId) => sessionId === 'session-old' ? oldDraft : undefined,
    oldAttachment.id,
  )

  assert.equal(target?.isActiveSession, false)
  assert.equal(target?.attachment, oldAttachment)
  assert.equal(target?.attachments, oldDraft)
  assert.equal(activeAttachments[0], newAttachment)
})

test('附件所属会话已不存在时不误写也不返回目标', () => {
  const target = findOwnedAttachmentTarget(
    'session-removed',
    'session-current',
    [],
    () => undefined,
    'attachment-old',
  )
  assert.equal(target, undefined)
})
