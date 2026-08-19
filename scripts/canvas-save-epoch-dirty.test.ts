import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { decideCanvasSaveDirty } from '../src/components/Canvas/canvasSaveDirty.ts'

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

  assert.match(persistSrc, /import \{ decideCanvasSaveDirty \} from '\.\.\/\.\.\/\.\.\/canvasSaveDirty'/)
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
