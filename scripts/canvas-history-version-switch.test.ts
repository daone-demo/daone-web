/**
 * 切换历史版本前先手动保存。
 * 运行：node --experimental-strip-types --test scripts/canvas-history-version-switch.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

/** 与 useCanvasShellProjectPanels.onSelectHistoryVersion 前置保存语义一致 */
async function selectHistoryVersionWithPriorSave(options: {
  saveCanvasAndWait: () => Promise<boolean>
  loadVersion: () => Promise<boolean>
}) {
  const saveOk = await options.saveCanvasAndWait()
  if (!saveOk) return 'save_failed' as const
  const loaded = await options.loadVersion()
  return loaded ? ('loaded' as const) : ('load_failed' as const)
}

test('保存成功后才加载历史版本', async () => {
  const calls: string[] = []
  const result = await selectHistoryVersionWithPriorSave({
    saveCanvasAndWait: async () => {
      calls.push('save')
      return true
    },
    loadVersion: async () => {
      calls.push('load')
      return true
    },
  })
  assert.equal(result, 'loaded')
  assert.deepEqual(calls, ['save', 'load'])
})

test('保存失败时不加载历史版本', async () => {
  const calls: string[] = []
  const result = await selectHistoryVersionWithPriorSave({
    saveCanvasAndWait: async () => {
      calls.push('save')
      return false
    },
    loadVersion: async () => {
      calls.push('load')
      return true
    },
  })
  assert.equal(result, 'save_failed')
  assert.deepEqual(calls, ['save'])
})

test('保存成功但加载失败', async () => {
  const result = await selectHistoryVersionWithPriorSave({
    saveCanvasAndWait: async () => true,
    loadVersion: async () => false,
  })
  assert.equal(result, 'load_failed')
})
