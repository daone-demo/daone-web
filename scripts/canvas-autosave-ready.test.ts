import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  flushPendingCanvasPayload,
  waitForCanvasRef,
} from '../src/views/CreateOrEdit/waitForCanvasRef.ts'

test('waitForCanvasRef 在 ref 稍后可用时返回实例', async () => {
  let canvas: { id: string } | null = null
  setTimeout(() => {
    canvas = { id: 'ready' }
  }, 30)

  const got = await waitForCanvasRef(() => canvas, { timeoutMs: 1000, intervalMs: 10 })
  assert.deepEqual(got, { id: 'ready' })
})

test('waitForCanvasRef 超时返回 null', async () => {
  const got = await waitForCanvasRef(() => null, { timeoutMs: 40, intervalMs: 10 })
  assert.equal(got, null)
})

test('初始化场景：loading 期间只缓存 pending，不阻塞等待 ref', () => {
  const loaded: unknown[] = []
  let canvas: { loadProjectCanvas: (p: { id: string }) => boolean } | null = null
  const pending = { id: 'canvas-1' }

  // 模拟 pageLoading=true：Canvas 未挂载，只能入队
  assert.equal(flushPendingCanvasPayload(canvas, pending), false)

  // 模拟 pageLoading=false 后 Canvas 就绪，再冲刷
  canvas = {
    loadProjectCanvas(payload) {
      loaded.push(payload)
      return true
    },
  }
  assert.equal(flushPendingCanvasPayload(canvas, pending), true)
  assert.deepEqual(loaded, [pending])
})

test('flushPendingCanvasPayload 在 canvas 就绪时注入并消费 pending', () => {
  const loaded: unknown[] = []
  const canvas = {
    loadProjectCanvas(payload: { projectId: string }) {
      loaded.push(payload)
      return true
    },
  }
  const pending = { projectId: 'p1' }
  assert.equal(flushPendingCanvasPayload(canvas, pending), true)
  assert.deepEqual(loaded, [pending])
  assert.equal(flushPendingCanvasPayload(null, pending), false)
  assert.equal(flushPendingCanvasPayload(canvas, null), false)
})

test('flushPendingCanvasPayload：load 失败时返回 false，调用方应保留 pending', () => {
  const canvas = {
    loadProjectCanvas() {
      return false
    },
  }
  assert.equal(flushPendingCanvasPayload(canvas, { projectId: 'p1' }), false)
})
