/**
 * 通知变更 action session 竞态约束。
 * 运行：node --experimental-strip-types --test scripts/notification-mutation-gate.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createNotificationMutationGate } from '../src/utils/notificationMutationGate.ts'

test('全部已读：重复提交被锁；身份变化后旧响应不可提交', async () => {
  let identity = 'user-a'
  const gate = createNotificationMutationGate(() => identity)

  const first = gate.beginMarkAll()
  assert.ok(first)
  assert.equal(gate.beginMarkAll(), null, '进行中不可重复 markAll')

  identity = 'user-b'
  assert.equal(first.canCommit(), false, '身份切换后丢弃迟到响应')
  first.end()

  const next = gate.beginMarkAll()
  assert.ok(next)
  assert.equal(next.canCommit(), true)
  next.end()
})

test('单条已读 / 删除：按通知 ID 加锁，invalidate 作废票据', () => {
  const gate = createNotificationMutationGate(() => 'user-a')
  const mark = gate.beginMarkOne('n-1')
  assert.ok(mark)
  assert.equal(gate.beginMarkOne('n-1'), null)
  assert.ok(gate.beginDelete('n-2'), '不同 ID 互不阻塞')

  gate.invalidate()
  assert.equal(mark.canCommit(), false)
  assert.ok(gate.beginMarkOne('n-1'), 'invalidate 后可重新操作')
})
