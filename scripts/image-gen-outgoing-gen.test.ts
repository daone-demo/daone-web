/**
 * 图生图 outgoing 占位复用：生成中节点不应被二次操作复用。
 * 运行：node --experimental-strip-types --test scripts/image-gen-outgoing-gen.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

function isReusableOutgoingGenNode(data: {
  kind?: string
  imageGenTask?: string
  imageGenState?: string
  generationTaskId?: string
  previewUrl?: string
  mode?: string
  title?: string
} | undefined): boolean {
  if (!data || data.kind !== 'image') return false
  if (!data.imageGenTask) return false
  if (data.imageGenState === 'loading') return false
  if (data.generationTaskId) return false
  const failed =
    data.imageGenState === 'failed' ||
    (data.title === '生成失败' && !data.previewUrl?.trim())
  if (data.previewUrl?.trim() && !failed) return false
  return true
}

test('生成中节点不可复用', () => {
  assert.equal(
    isReusableOutgoingGenNode({
      kind: 'image',
      imageGenTask: 'picker',
      imageGenState: 'loading',
      generationTaskId: 'task-1',
    }),
    false,
  )
})

test('空占位 picker 可复用', () => {
  assert.equal(
    isReusableOutgoingGenNode({
      kind: 'image',
      imageGenTask: 'picker',
      mode: 'picker',
      imageGenState: 'idle',
    }),
    true,
  )
})

test('已成片节点不可复用', () => {
  assert.equal(
    isReusableOutgoingGenNode({
      kind: 'image',
      imageGenTask: 'picker',
      imageGenState: 'done',
      previewUrl: 'https://example.com/a.png',
    }),
    false,
  )
})

test('失败节点可复用', () => {
  assert.equal(
    isReusableOutgoingGenNode({
      kind: 'image',
      imageGenTask: 'picker',
      imageGenState: 'failed',
      title: '生成失败',
    }),
    true,
  )
})
