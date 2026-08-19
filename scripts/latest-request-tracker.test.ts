import assert from 'node:assert/strict'
import test from 'node:test'
import { createLatestRequestTracker } from '../src/utils/latestRequestTracker.ts'

test('后发起的请求生效，先返回的旧响应被丢弃', async () => {
  const tracker = createLatestRequestTracker()
  const first = tracker.begin()
  const second = tracker.begin()
  assert.equal(first(), false)
  assert.equal(second(), true)
})

test('invalidate 后进行中的响应全部失效', () => {
  const tracker = createLatestRequestTracker()
  const current = tracker.begin()
  assert.equal(current(), true)
  tracker.invalidate()
  assert.equal(current(), false)
  const next = tracker.begin()
  assert.equal(next(), true)
})
