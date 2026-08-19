import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyAiPointEstimateFailure,
  applyAiPointEstimateSuccess,
  clearAiPointEstimate,
  createAiPointEstimateState,
  invalidateAiPointEstimate,
} from '../src/components/Canvas/composables/aiPointEstimateState.ts'

test('参数变化作废旧请求但保留上一次积分，避免回落静态占位', () => {
  let state = { ...createAiPointEstimateState(), seq: 1, estimatedPoints: 120 }

  state = invalidateAiPointEstimate(state)
  assert.equal(state.estimatedPoints, 120, 'signature 变化应保留旧积分防跳动')
  assert.equal(state.seq, 2)

  state = applyAiPointEstimateFailure(state, 2)
  assert.equal(state.estimatedPoints, 120, '当前序列失败也应保留上次有效预估')
})

test('参数变化后，过期的成功响应不得写回旧积分', () => {
  let state = { ...createAiPointEstimateState(), seq: 1, estimatedPoints: 120 }

  state = invalidateAiPointEstimate(state)
  assert.equal(state.estimatedPoints, 120)

  state = applyAiPointEstimateSuccess(state, 1, { estimatedPoints: 999 })
  assert.equal(state.estimatedPoints, 120, '过期成功响应必须忽略')

  state = applyAiPointEstimateSuccess(state, 2, { estimatedPoints: 88 })
  assert.equal(state.estimatedPoints, 88, '当前序列成功仍应写入新积分')
})

test('过期失败不得覆盖已经成功的新预估', () => {
  let state = { ...createAiPointEstimateState(), seq: 2, estimatedPoints: 88 }

  state = applyAiPointEstimateFailure(state, 1)
  assert.equal(state.estimatedPoints, 88)
})

test('不可预估场景可主动清空', () => {
  let state = { ...createAiPointEstimateState(), seq: 2, estimatedPoints: 88 }
  state = clearAiPointEstimate(state)
  assert.equal(state.estimatedPoints, null)
  assert.equal(state.seq, 2)
})
