/**
 * generation-tasks 请求 count / videoCount 拆分工具测试。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeGenerationTaskCreateRequest,
  normalizeGenerationTaskParameters,
  resolveGenerationTaskRequestCount,
} from '../src/services/generationTaskRequest.ts'

test('resolveGenerationTaskRequestCount 读取 count', () => {
  assert.equal(resolveGenerationTaskRequestCount({ count: 2 }), 2)
  assert.equal(resolveGenerationTaskRequestCount({ count: 0 }), 1)
  assert.equal(resolveGenerationTaskRequestCount({ count: '3' }), 3)
})

test('resolveGenerationTaskRequestCount 读取 videoCount', () => {
  assert.equal(resolveGenerationTaskRequestCount({ videoCount: 4 }), 4)
})

test('normalizeGenerationTaskParameters 强制单次 count / videoCount', () => {
  assert.deepEqual(normalizeGenerationTaskParameters({ count: 3, model: 'm' }), {
    count: 1,
    model: 'm',
  })
  assert.deepEqual(normalizeGenerationTaskParameters({ count: 2, videoCount: 5 }), {
    count: 1,
    videoCount: 1,
  })
})

test('normalizeGenerationTaskCreateRequest 归一化请求体 parameters', () => {
  const normalized = normalizeGenerationTaskCreateRequest({
    capabilityCode: 'IMAGE_GENERAL_V1',
    parameters: { count: 2, aspectRatio: '1:1' },
  })
  assert.equal(normalized.parameters?.count, 1)
  assert.equal(normalized.parameters?.aspectRatio, '1:1')
  assert.equal(normalized.capabilityCode, 'IMAGE_GENERAL_V1')
})
