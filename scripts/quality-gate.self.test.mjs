/**
 * quality-gate 自测：注释误报、未登记 alias、过期白名单。
 * 运行：node --test scripts/quality-gate.self.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { scanSourceForViolations, stripCommentsForScan } from './quality-gate.mjs'

test('注释中的 type X = any 不应失败', () => {
  const src = `/**
 * quality-gate 锁定：\`type X = any\` 必须登记白名单。
 */
export type Foo = string
`
  const violations = scanSourceForViolations('src/demo.ts', src, { whitelist: [] })
  assert.deepEqual(violations, [])
})

test('未登记真实 type alias any 应失败', () => {
  const src = `type BadAny = any\n`
  const violations = scanSourceForViolations('src/demo.ts', src, { whitelist: [] })
  assert.equal(violations.length, 1)
  assert.match(violations[0], /未登记白名单/)
})

test('登记项过期应失败', () => {
  const src = `type CoreRuntimeSlotReturn = any\n`
  const violations = scanSourceForViolations(
    'src/components/Canvas/composables/useCanvas/runtime/installedSlots.ts',
    src,
    {
      now: Date.parse('2026-10-01T00:00:00Z'),
      whitelist: [
        {
          file: 'src/components/Canvas/composables/useCanvas/runtime/installedSlots.ts',
          name: 'CoreRuntimeSlotReturn',
          owner: 'canvas-runtime',
          expire: '2026-09-30',
        },
      ],
    },
  )
  assert.equal(violations.length, 1)
  assert.match(violations[0], /已过期/)
})

test('行注释与块注释剥离', () => {
  const a = stripCommentsForScan('type A = string // type X = any', false)
  assert.match(a.code, /type A = string/)
  assert.equal(a.code.includes('any'), false)

  const b1 = stripCommentsForScan('const x = 1; /* type X = any', false)
  assert.equal(b1.nextInBlock, true)
  const b2 = stripCommentsForScan(' still comment */ type Y = number', true)
  assert.equal(b2.nextInBlock, false)
  assert.match(b2.code, /type Y = number/)
})
