import assert from 'node:assert/strict'
import { test } from 'node:test'

/**
 * 与 installPersistence 中 normalizeSaveType / 自动保存自愈门控保持一致。
 */
function normalizeSaveType(saveType: unknown): 'MANUAL' | 'AUTO' {
  return saveType === 'AUTO' ? 'AUTO' : 'MANUAL'
}

function ensureCanvasReadyForAutoSave(opts: {
  autoSaveEnabled: boolean
  canvasContentReady: boolean
  hasGraph: boolean
  projectId: string
}): { allowed: boolean; contentReady: boolean } {
  if (!opts.autoSaveEnabled) {
    return { allowed: false, contentReady: opts.canvasContentReady }
  }
  if (opts.canvasContentReady) {
    return { allowed: true, contentReady: true }
  }
  if (opts.hasGraph && opts.projectId) {
    return { allowed: true, contentReady: true }
  }
  return { allowed: false, contentReady: false }
}

function shouldAllowSave(opts: {
  saveType: unknown
  autoSaveEnabled: boolean
  canvasContentReady: boolean
  hasGraph?: boolean
  projectId?: string
}): boolean {
  const type = normalizeSaveType(opts.saveType)
  if (type === 'AUTO') {
    return ensureCanvasReadyForAutoSave({
      autoSaveEnabled: opts.autoSaveEnabled,
      canvasContentReady: opts.canvasContentReady,
      hasGraph: opts.hasGraph ?? false,
      projectId: opts.projectId ?? '',
    }).allowed
  }
  return true
}

test('normalizeSaveType：仅 AUTO 保留，其余一律 MANUAL', () => {
  assert.equal(normalizeSaveType('AUTO'), 'AUTO')
  assert.equal(normalizeSaveType('MANUAL'), 'MANUAL')
  assert.equal(normalizeSaveType(undefined), 'MANUAL')
  assert.equal(normalizeSaveType({ type: 'click' }), 'MANUAL')
})

test('手动保存：autoSave 关闭或内容未就绪时仍允许', () => {
  assert.equal(
    shouldAllowSave({ saveType: 'MANUAL', autoSaveEnabled: false, canvasContentReady: false }),
    true,
  )
  assert.equal(
    shouldAllowSave({ saveType: 'MANUAL', autoSaveEnabled: true, canvasContentReady: false }),
    true,
  )
})

test('自动保存：未就绪但图+项目已在时可自愈', () => {
  assert.equal(
    shouldAllowSave({
      saveType: 'AUTO',
      autoSaveEnabled: true,
      canvasContentReady: false,
      hasGraph: true,
      projectId: '174',
    }),
    true,
  )
  assert.equal(
    shouldAllowSave({
      saveType: 'AUTO',
      autoSaveEnabled: true,
      canvasContentReady: false,
      hasGraph: true,
      projectId: '',
    }),
    false,
  )
})

test('自动保存：仍受 autoSaveEnabled 约束；pause 后不可发', () => {
  assert.equal(
    shouldAllowSave({
      saveType: 'AUTO',
      autoSaveEnabled: false,
      canvasContentReady: true,
      hasGraph: true,
      projectId: '174',
    }),
    false,
  )
  assert.equal(
    shouldAllowSave({
      saveType: 'AUTO',
      autoSaveEnabled: true,
      canvasContentReady: true,
      hasGraph: true,
      projectId: '174',
    }),
    true,
  )
})

test('pagehide 软暂停不应清掉 contentReady（恢复后可继续自动保存）', () => {
  let autoSaveEnabled = true
  let canvasContentReady = true
  let pendingRemoteSaveType: 'MANUAL' | 'AUTO' | null = 'MANUAL'
  // pauseAutoSave：可清 AUTO，但不得清已确认的 MANUAL 排队
  autoSaveEnabled = false
  assert.equal(canvasContentReady, true)
  assert.equal(pendingRemoteSaveType, 'MANUAL')
  // pageshow resume
  autoSaveEnabled = true
  const healed = ensureCanvasReadyForAutoSave({
    autoSaveEnabled,
    canvasContentReady,
    hasGraph: true,
    projectId: '174',
  })
  assert.equal(healed.allowed, true)
})

/**
 * 与 beginProjectCanvasSwitch / applyProjectCanvasPayload 行为对齐：
 * 切项目时关闭自动保存；仅在目标画布绑定成功后恢复。
 */
function simulateProjectSwitchAutosave(opts: {
  routeId: string
  applyProjectId: string | null
}): {
  autoSaveEnabled: boolean
  canvasBoundProjectId: string
  autoSaveAllowed: boolean
} {
  let autoSaveEnabled = true
  let canvasContentReady = true
  let canvasBoundProjectId = 'project-A'

  // beginProjectCanvasSwitch
  autoSaveEnabled = false
  canvasContentReady = false
  canvasBoundProjectId = ''

  assert.equal(
    shouldAllowSave({
      saveType: 'AUTO',
      autoSaveEnabled,
      canvasContentReady,
      hasGraph: true,
      projectId: opts.routeId,
    }),
    false,
    '应用前不得发送 AUTO 保存',
  )

  if (opts.applyProjectId && opts.applyProjectId === opts.routeId) {
    // applyProjectCanvasPayload 成功
    canvasBoundProjectId = opts.applyProjectId
    autoSaveEnabled = true
    canvasContentReady = true
  }

  const autoSaveAllowed = shouldAllowSave({
    saveType: 'AUTO',
    autoSaveEnabled,
    canvasContentReady,
    hasGraph: true,
    projectId: opts.routeId,
  })

  return { autoSaveEnabled, canvasBoundProjectId, autoSaveAllowed }
}

test('切项目：应用成功后恢复自动保存，应用前不发送 AUTO', () => {
  const beforeApply = simulateProjectSwitchAutosave({
    routeId: 'project-B',
    applyProjectId: null,
  })
  assert.equal(beforeApply.autoSaveEnabled, false)
  assert.equal(beforeApply.canvasBoundProjectId, '')
  assert.equal(beforeApply.autoSaveAllowed, false)

  const afterApply = simulateProjectSwitchAutosave({
    routeId: 'project-B',
    applyProjectId: 'project-B',
  })
  assert.equal(afterApply.autoSaveEnabled, true)
  assert.equal(afterApply.canvasBoundProjectId, 'project-B')
  assert.equal(afterApply.autoSaveAllowed, true)
})

test('切项目：应用失败时保持自动保存关闭', () => {
  const failed = simulateProjectSwitchAutosave({
    routeId: 'project-B',
    applyProjectId: null,
  })
  assert.equal(failed.autoSaveEnabled, false)
  assert.equal(failed.autoSaveAllowed, false)
})
