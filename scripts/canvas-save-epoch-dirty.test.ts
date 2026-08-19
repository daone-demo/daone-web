import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { decideCanvasSaveDirty, decideManualSaveLeaveNext } from '../src/components/Canvas/canvasSaveDirty.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

test('epoch 未变化：保存成功后清除 dirty，不追加保存', () => {
  const decision = decideCanvasSaveDirty(4, 4)
  assert.equal(decision.localDirty, false)
  assert.equal(decision.projectSaved, true)
  assert.equal(decision.scheduleFollowUpSave, false)
})

test('保存发出后继续编辑：保留 dirty 并调度下一次保存', () => {
  const decision = decideCanvasSaveDirty(4, 5)
  assert.equal(decision.localDirty, true)
  assert.equal(decision.projectSaved, false)
  assert.equal(decision.scheduleFollowUpSave, true)
})

test('installPersistence：成功路径用 epoch 决定 dirty，冲突覆盖策略保持不变', () => {
  const persistSrc = readSrc(
    'src/components/Canvas/composables/useCanvas/runtime/installPersistence.ts',
  )

  assert.match(persistSrc, /from '\.\.\/\.\.\/\.\.\/canvasSaveDirty'/)
  assert.match(persistSrc, /decideCanvasSaveDirty/)
  assert.match(persistSrc, /const epochAtStart = saveEpoch \?\? \(ctx\.localChangeEpoch \|\| 0\)/)
  assert.match(persistSrc, /applySuccessfulPersist\(epochAtStart\)/)
  assert.match(
    persistSrc,
    /const latestRevision = ctx\.extractLatestRevision\(error\);\s*if \(latestRevision == null\)\s*throw error/,
  )
  assert.match(persistSrc, /const freshSnapshot = ctx\.buildCanvasSnapshot\(\) \?\? snapshot/)
  assert.match(persistSrc, /const retryEpoch = ctx\.localChangeEpoch \|\| 0/)
  assert.match(persistSrc, /applySuccessfulPersist\(retryEpoch\)/)
  assert.equal(persistSrc.includes('ctx.localDirty = false'), true, '加载/切项目仍可直接清 dirty')
  assert.match(persistSrc, /decideCanvasSaveDirty\(epochCaptured, ctx\.localChangeEpoch \|\| 0\)/)
})

test('保存并离开：epoch 仍 dirty 时继续保存，清空后才允许离开', () => {
  assert.equal(
    decideManualSaveLeaveNext({
      flushOk: true,
      stillDirty: false,
      attempt: 1,
      maxAttempts: 8,
      elapsedMs: 10,
      maxWaitMs: 30_000,
    }),
    'success',
  )
  assert.equal(
    decideManualSaveLeaveNext({
      flushOk: true,
      stillDirty: true,
      attempt: 1,
      maxAttempts: 8,
      elapsedMs: 10,
      maxWaitMs: 30_000,
    }),
    'continue',
  )
  assert.equal(
    decideManualSaveLeaveNext({
      flushOk: false,
      stillDirty: true,
      attempt: 1,
      maxAttempts: 8,
      elapsedMs: 10,
      maxWaitMs: 30_000,
    }),
    'fail',
  )
  assert.equal(
    decideManualSaveLeaveNext({
      flushOk: true,
      stillDirty: true,
      attempt: 8,
      maxAttempts: 8,
      elapsedMs: 10,
      maxWaitMs: 30_000,
    }),
    'fail',
  )
})

test('installPersistence：手动保存离开路径会重查 dirty 并跟刷最新快照', () => {
  const persistSrc = readSrc(
    'src/components/Canvas/composables/useCanvas/runtime/installPersistence.ts',
  )
  assert.match(persistSrc, /import \{\s*decideCanvasSaveDirty,\s*decideManualSaveLeaveNext/)
  assert.match(persistSrc, /decideManualSaveLeaveNext\(/)
  assert.match(persistSrc, /stillDirty: ctx\.hasUnsavedChanges\(\)/)
  assert.match(persistSrc, /for \(let attempt = 1; attempt <= MANUAL_SAVE_LEAVE_MAX_ATTEMPTS/)
})

test('runtime context 不再用 any 动态袋', () => {
  const contextSrc = readSrc(
    'src/components/Canvas/composables/useCanvas/runtime/context.ts',
  )
  assert.equal(/\bRecord<string,\s*any>/.test(contextSrc), false)
  assert.match(contextSrc, /asCoreRuntimeContext/)
  assert.match(contextSrc, /CoreRuntimeInstallSlots/)
})
