import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isCanvasResponseApplicable,
  normalizeRouteProjectId,
  shouldFlushPendingCanvasSlot,
} from '../src/views/CreateOrEdit/canvasLoadGuard.ts'

test('normalizeRouteProjectId：支持 string / array / 空值', () => {
  assert.equal(normalizeRouteProjectId(' 174 '), '174')
  assert.equal(normalizeRouteProjectId([' 88 ']), '88')
  assert.equal(normalizeRouteProjectId(undefined), '')
  assert.equal(normalizeRouteProjectId(null), '')
})

test('A 慢 B 快：旧 epoch 响应不可应用', () => {
  assert.equal(
    isCanvasResponseApplicable({
      requestEpoch: 1,
      currentEpoch: 2,
      targetId: 'A',
      routeId: 'B',
      responseProjectId: 'A',
    }),
    false,
  )
})

test('当前请求：target / route / response.projectId 一致才可应用', () => {
  assert.equal(
    isCanvasResponseApplicable({
      requestEpoch: 3,
      currentEpoch: 3,
      targetId: 'B',
      routeId: 'B',
      responseProjectId: 'B',
    }),
    true,
  )
  assert.equal(
    isCanvasResponseApplicable({
      requestEpoch: 3,
      currentEpoch: 3,
      targetId: 'B',
      routeId: 'B',
      responseProjectId: 'A',
    }),
    false,
  )
  assert.equal(
    isCanvasResponseApplicable({
      requestEpoch: 3,
      currentEpoch: 3,
      targetId: 'B',
      routeId: 'A',
      responseProjectId: 'B',
    }),
    false,
  )
})

test('初始化期间切路由：旧 pending 不得冲刷到新项目', () => {
  const pending = {
    epoch: 1,
    projectId: 'A',
    payload: { projectId: 'A' },
  }
  assert.equal(
    shouldFlushPendingCanvasSlot(pending, { currentEpoch: 2, routeId: 'B' }),
    false,
  )
  assert.equal(
    shouldFlushPendingCanvasSlot(
      { epoch: 2, projectId: 'B', payload: { projectId: 'B' } },
      { currentEpoch: 2, routeId: 'B' },
    ),
    true,
  )
})

test('旧响应到达后：保存目标应以路由为准（resolve 约束模拟）', () => {
  function resolveActiveProjectId(activeId: string, routeId: string): string {
    const fromRoute = normalizeRouteProjectId(routeId)
    if (fromRoute) return fromRoute
    return normalizeRouteProjectId(activeId)
  }
  // 过期响应曾把 active 改回 A，但地址栏仍是 B
  assert.equal(resolveActiveProjectId('A', 'B'), 'B')
})
