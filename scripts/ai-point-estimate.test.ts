/**
 * 积分预估状态机：参数变化 / 失败不得展示旧参数价格。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyAiPointEstimateFailure,
  applyAiPointEstimateSuccess,
  clearAiPointEstimate,
  createAiPointEstimateState,
  invalidateAiPointEstimate,
} from '../src/components/Canvas/composables/aiPointEstimateState.ts'

test('参数变化进入 loading 并清空旧积分', () => {
  let state = {
    ...createAiPointEstimateState(),
    seq: 1,
    estimatedPoints: 120,
    status: 'ready' as const,
  }

  state = invalidateAiPointEstimate(state)
  assert.equal(state.estimatedPoints, null)
  assert.equal(state.status, 'loading')
  assert.equal(state.seq, 2)
})

test('当前序列失败清空积分并标记 error', () => {
  let state = {
    ...createAiPointEstimateState(),
    seq: 2,
    estimatedPoints: null,
    status: 'loading' as const,
  }
  state = applyAiPointEstimateFailure(state, 2)
  assert.equal(state.estimatedPoints, null)
  assert.equal(state.status, 'error')
})

test('参数变化后，过期的成功响应不得写回旧积分', () => {
  let state = invalidateAiPointEstimate({
    ...createAiPointEstimateState(),
    seq: 1,
    estimatedPoints: 120,
    status: 'ready',
  })

  state = applyAiPointEstimateSuccess(state, 1, { estimatedPoints: 999 })
  assert.equal(state.estimatedPoints, null, '过期成功响应必须忽略')

  state = applyAiPointEstimateSuccess(state, 2, { estimatedPoints: 88 })
  assert.equal(state.estimatedPoints, 88)
  assert.equal(state.status, 'ready')
})

test('过期失败不得覆盖已经成功的新预估', () => {
  let state = {
    ...createAiPointEstimateState(),
    seq: 2,
    estimatedPoints: 88,
    status: 'ready' as const,
  }

  state = applyAiPointEstimateFailure(state, 1)
  assert.equal(state.estimatedPoints, 88)
  assert.equal(state.status, 'ready')
})

test('不可预估场景可主动清空', () => {
  let state = {
    ...createAiPointEstimateState(),
    seq: 2,
    estimatedPoints: 88,
    status: 'ready' as const,
  }
  state = clearAiPointEstimate(state)
  assert.equal(state.estimatedPoints, null)
  assert.equal(state.status, 'idle')
  assert.equal(state.seq, 2)
})
