import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveTitlePrefix } from '../src/components/Canvas/lib/resolveTitlePrefix.ts'
import {
  buildGroupExecuteConfirmContent,
  estimateGroupExecuteCredits,
} from '../src/components/Canvas/groupExecute/credits.ts'

test('resolveTitlePrefix 解析标题能力前缀', () => {
  assert.equal(resolveTitlePrefix(''), '')
  assert.equal(resolveTitlePrefix('  '), '')
  assert.equal(resolveTitlePrefix('抠图'), '抠图')
  assert.equal(resolveTitlePrefix('抠图-角色A'), '抠图')
  assert.equal(resolveTitlePrefix('反推提示词-结果1'), '反推提示词')
})

test('estimateGroupExecuteCredits 累加任务积分', () => {
  assert.equal(estimateGroupExecuteCredits([]), 0)
  assert.equal(
    estimateGroupExecuteCredits([
      { creditCost: 10 } as never,
      { creditCost: 22 } as never,
    ]),
    32,
  )
})

test('buildGroupExecuteConfirmContent 文案契约', () => {
  const empty = buildGroupExecuteConfirmContent(0, 0)
  assert.match(empty.main, /0 个生成节点/)
  assert.ok(empty.hint)

  const batch = buildGroupExecuteConfirmContent(3, 99)
  assert.match(batch.main, /3 个生成节点/)
  assert.match(batch.hint, /并行执行/)
})
