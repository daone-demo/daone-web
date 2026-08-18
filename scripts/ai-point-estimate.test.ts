import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyAiPointEstimateFailure,
  applyAiPointEstimateSuccess,
  createAiPointEstimateState,
  invalidateAiPointEstimate,
} from '../src/components/Canvas/composables/aiPointEstimateState.ts'

test('旧值 → 参数变化立即清空，失败后保持静态占位而不是旧积分', () => {
  let state = { ...createAiPointEstimateState(), seq: 1, estimatedPoints: 120 }

  state = invalidateAiPointEstimate(state)
  assert.equal(state.estimatedPoints, null, 'signature 变化应立即丢掉旧积分')
  assert.equal(state.seq, 2)

  state = applyAiPointEstimateFailure(state, 2)
  assert.equal(state.estimatedPoints, null, '当前序列失败应回退静态占位')
})

test('参数变化后，过期的成功响应不得写回旧积分', () => {
  let state = { ...createAiPointEstimateState(), seq: 1, estimatedPoints: 120 }

  state = invalidateAiPointEstimate(state)
  assert.equal(state.estimatedPoints, null)

  state = applyAiPointEstimateSuccess(state, 1, { estimatedPoints: 120 })
  assert.equal(state.estimatedPoints, null, '过期成功响应必须忽略')

  state = applyAiPointEstimateSuccess(state, 2, { estimatedPoints: 88 })
  assert.equal(state.estimatedPoints, 88, '当前序列成功仍应写入新积分')
})

test('过期失败不得覆盖已经成功的新预估', () => {
  let state = { ...createAiPointEstimateState(), seq: 2, estimatedPoints: 88 }

  state = applyAiPointEstimateFailure(state, 1)
  assert.equal(state.estimatedPoints, 88)
})
