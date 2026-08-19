import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

test('套餐加载有捕获且用请求序列丢弃迟到响应', () => {
  const comboSrc = readSrc('src/components/Combo/index.vue')
  assert.match(comboSrc, /const plansLoadTracker = createLatestRequestTracker\(\)/)
  assert.match(comboSrc, /const isCurrent = plansLoadTracker\.begin\(\)/)
  assert.match(comboSrc, /console\.error\('onloadPlans'/)
  assert.match(comboSrc, /plansLoadTracker\.invalidate\(\)/)
})

test('试用状态加载绑定请求序列和登录身份，关闭弹窗作废旧响应', () => {
  const comboSrc = readSrc('src/components/Combo/index.vue')
  assert.match(comboSrc, /const trialStatusTracker = createLatestRequestTracker\(\)/)
  assert.match(comboSrc, /const identity = trialIdentityKey\(\)/)
  assert.match(
    comboSrc,
    /if \(!isCurrent\(\) \|\| identity !== trialIdentityKey\(\)\) return/,
  )
  assert.match(comboSrc, /trialStatusTracker\.invalidate\(\)/)
  assert.match(comboSrc, /applyTrialStatusData\(\{ status: 'NONE' \}\)/)
})
