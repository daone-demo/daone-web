import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  CANVAS_REVISION_CONFLICT_CODE,
  CANVAS_REVISION_CONFLICT_MAX_ATTEMPTS,
  decideCanvasSaveDirty,
  decideManualSaveLeaveNext,
  parseCanvasLatestRevision,
} from '../src/components/Canvas/canvasSaveDirty.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function fakeConflictError(latestRevision: unknown, code = CANVAS_REVISION_CONFLICT_CODE) {
  return { code, data: { latestRevision }, message: '版本冲突' }
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

test('parseCanvasLatestRevision：支持 number / 数字字符串，忽略非冲突', () => {
  assert.equal(parseCanvasLatestRevision(fakeConflictError(12)), 12)
  assert.equal(parseCanvasLatestRevision(fakeConflictError('15')), 15)
  assert.equal(parseCanvasLatestRevision(fakeConflictError(1, 'INTERNAL')), null)
})

test('installPersistence：静默保存 + 冲突循环重试 + flush 全程持锁', () => {
  const persistSrc = readSrc(
    'src/components/Canvas/composables/useCanvas/runtime/installPersistence.ts',
  )

  assert.match(persistSrc, /from '\.\.\/\.\.\/\.\.\/canvasSaveDirty'/)
  assert.match(persistSrc, /decideCanvasSaveDirty/)
  assert.match(persistSrc, /parseCanvasLatestRevision/)
  assert.match(persistSrc, /CANVAS_REVISION_CONFLICT_MAX_ATTEMPTS/)
  assert.match(persistSrc, /const epochAtStart = saveEpoch \?\? \(ctx\.localChangeEpoch \|\| 0\)/)
  assert.match(persistSrc, /applySuccessfulPersist\(attemptEpoch\)/)
  assert.match(persistSrc, /silent:\s*true/)
  assert.match(
    persistSrc,
    /for \(let attempt = 1; attempt <= CANVAS_REVISION_CONFLICT_MAX_ATTEMPTS/,
  )
  assert.match(persistSrc, /attemptSnapshot = ctx\.buildCanvasSnapshot\(\) \?\? attemptSnapshot/)
  assert.equal(persistSrc.includes('ctx.localDirty = false'), true, '加载/切项目仍可直接清 dirty')
  assert.match(persistSrc, /decideCanvasSaveDirty\(epochCaptured, ctx\.localChangeEpoch \|\| 0\)/)
  assert.match(persistSrc, /manageInFlight:\s*false/)
  assert.match(persistSrc, /\/\/ 在任意 await 前占住锁/)
  assert.equal(CANVAS_REVISION_CONFLICT_MAX_ATTEMPTS >= 2, true)
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
  assert.match(persistSrc, /import \{\s*CANVAS_REVISION_CONFLICT_MAX_ATTEMPTS,\s*decideCanvasSaveDirty,\s*decideManualSaveLeaveNext/)
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
