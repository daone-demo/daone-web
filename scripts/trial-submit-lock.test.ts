import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runWithSubmitLock } from '../src/utils/submitLock.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

test('请求进行中重复点击只执行一次，成功后解锁', async () => {
  const lock = { value: false }
  let started = 0
  let finished = 0
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })

  const first = runWithSubmitLock(lock, async () => {
    started += 1
    await pending
    finished += 1
    return 'ok'
  })
  const second = runWithSubmitLock(lock, async () => {
    started += 1
    finished += 1
    return 'dup'
  })

  assert.equal(lock.value, true)
  assert.equal(await second, undefined, '锁占用期间第二次提交必须直接返回')
  release()
  assert.equal(await first, 'ok')
  assert.equal(started, 1)
  assert.equal(finished, 1)
  assert.equal(lock.value, false)
})

test('失败后解锁，允许再次提交', async () => {
  const lock = { value: false }
  await assert.rejects(
    () =>
      runWithSubmitLock(lock, async () => {
        throw new Error('network')
      }),
    /network/,
  )
  assert.equal(lock.value, false)

  const retry = await runWithSubmitLock(lock, async () => 'retried')
  assert.equal(retry, 'retried')
})

test('试用申请提交使用独立锁、禁用按钮并传递幂等键', () => {
  const comboSrc = readSrc('src/components/Combo/index.vue')
  const apiSrc = readSrc('src/services/api.ts')

  assert.match(comboSrc, /const trialSubmitting = ref\(false\)/)
  assert.match(comboSrc, /runWithSubmitLock\(trialSubmitting/)
  assert.match(comboSrc, /if \(trialSubmitting\.value\) return true/)
  assert.match(
    comboSrc,
    /createTrialApplication\(\s*\{[\s\S]*?position:\s*trialPosition\.value\.trim\(\),[\s\S]*?\},\s*uuidv4\(\),/,
  )
  assert.match(
    apiSrc,
    /createTrialApplication[\s\S]*?headers:\s*idempotencyKey \? \{ 'Idempotency-Key': idempotencyKey \}/,
  )
  assert.match(comboSrc, /message\.success\('操作成功'\)/)
  assert.match(comboSrc, /console\.error\('submitTrial'/)
})
