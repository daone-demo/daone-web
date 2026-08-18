import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

test('试用验证码与后端约定走 /auth/sms-code + scene TRIAL', () => {
  const apiSrc = readSrc('src/services/api.ts')
  const comboSrc = readSrc('src/components/Combo/index.vue')
  const typesSrc = readSrc('src/types/types.ts')

  assert.match(apiSrc, /querySmsCode[\s\S]*?http\.post\('\/auth\/sms-code'/)
  assert.equal(apiSrc.includes('queryTrialSmsCode'), false)
  assert.doesNotMatch(apiSrc, /http\.post\(['"]\/trial-applications\/sms-code['"]/)
  assert.match(typesSrc, /SmsCodeScene = 'login' \| 'TRIAL'/)
  assert.match(
    comboSrc,
    /querySmsCode\(\{\s*phone:\s*trialPhone\.value\.trim\(\),\s*scene:\s*'TRIAL'\s*\}\)/,
  )
  assert.match(apiSrc, /createTrialApplication[\s\S]*?http\.post<T>\('\/trial-applications'/)
  assert.match(
    apiSrc,
    /getTrialApplicationStatus[\s\S]*?http\.get<T>\('\/trial-applications\/status'/,
  )
})
