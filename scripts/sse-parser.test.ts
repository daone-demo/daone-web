import assert from 'node:assert/strict'
import test from 'node:test'
import { createSSEParser, type SSEEvent } from '../src/hooks/sseParser.ts'

function collectSSE(chunks: string[], finishTail = '') {
  const events: SSEEvent[] = []
  const parser = createSSEParser((event) => {
    events.push(event)
  })
  for (const chunk of chunks) parser.push(chunk)
  parser.finish(finishTail)
  return events
}

test('SSE 按空行派发并拼接多行 data', () => {
  const events = collectSSE([
    'event: update\n',
    'data: {"message":"first",\n',
    'data: "count":2}\n\n',
  ])

  assert.deepEqual(events, [{
    event: 'update',
    data: '{"message":"first",\n"count":2}',
  }])
})

test('SSE 可跨任意字节分块并正确刷新 TextDecoder 尾部', () => {
  const source = 'event: 消息\r\ndata: 第一行\r\ndata: 第二行\r\n\r\n'
  const bytes = new TextEncoder().encode(source)
  const decoder = new TextDecoder()
  const events: SSEEvent[] = []
  const parser = createSSEParser((event) => events.push(event))

  for (const byte of bytes) {
    parser.push(decoder.decode(Uint8Array.of(byte), { stream: true }))
  }
  parser.finish(decoder.decode())

  assert.deepEqual(events, [{
    event: '消息',
    data: '第一行\n第二行',
  }])
})

test('SSE 支持 CRLF、独立 CR、注释和未知字段', () => {
  const events = collectSSE([
    ': keep-alive\r\n',
    'id: 42\r',
    'event: progress\r',
    'data: 50%\r',
    '\r',
  ])

  assert.deepEqual(events, [{ event: 'progress', data: '50%' }])
})

test('SSE 在 EOF 处理残余行和最后一个未闭合事件', () => {
  const events = collectSSE([
    'event: final\n',
    'data: first\n',
    'data: second',
  ])

  assert.deepEqual(events, [{
    event: 'final',
    data: 'first\nsecond',
  }])
})

test('SSE 忽略没有 data 字段的空事件并重置事件名', () => {
  const events = collectSSE([
    'event: ignored\n\n',
    'data: default event\n\n',
  ])

  assert.deepEqual(events, [{ data: 'default event', event: undefined }])
})

test('SSE data 只移除冒号后的一个可选空格', () => {
  const events = collectSSE(['data:  保留一个前导空格  \n\n'])
  assert.deepEqual(events, [{ data: ' 保留一个前导空格  ', event: undefined }])
})

test('SSE 处理器可由回调停止，后续数据不再派发', () => {
  const events: SSEEvent[] = []
  const parser = createSSEParser((event) => {
    events.push(event)
    return false
  })

  assert.equal(parser.push('data: [DONE]\n\n'), false)
  assert.equal(parser.push('data: ignored\n\n'), false)
  assert.equal(parser.finish(), false)
  assert.deepEqual(events, [{ data: '[DONE]', event: undefined }])
})
