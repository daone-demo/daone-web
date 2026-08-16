import assert from 'node:assert/strict'
import { test } from 'node:test'

type SaveType = 'MANUAL' | 'AUTO'

type PendingSaveJob = {
  projectId: string
  snapshot: { rev: number }
  type: SaveType
  resolve: (ok: boolean) => void
}

/**
 * 与 installPersistence 保存队列 / dirty / pause 行为对齐的精简模型，
 * 覆盖 P1-03：防抖窗口内离开、并发手动保存、pagehide 不清 MANUAL。
 */
function createSaveGateModel(options?: {
  persist?: (snapshot: { rev: number }, type: SaveType) => Promise<boolean>
}) {
  let localDirty = false
  let saveInFlight = false
  let autoSaveEnabled = true
  let pendingRemoteSaveType: SaveType | null = null
  let pendingSaveJobs: PendingSaveJob[] = []
  let projectSaved = true
  const serverSnapshots: { rev: number; type: SaveType }[] = []
  const persist = options?.persist ?? (async (snapshot, type) => {
    serverSnapshots.push({ rev: snapshot.rev, type })
    return true
  })

  function markLocalCanvasChange() {
    localDirty = true
    projectSaved = false
  }

  function syncPendingFlag() {
    if (pendingSaveJobs.some((j) => j.type === 'MANUAL')) pendingRemoteSaveType = 'MANUAL'
    else if (pendingSaveJobs.length) pendingRemoteSaveType = 'AUTO'
    else pendingRemoteSaveType = null
  }

  function hasUnsavedChanges() {
    return localDirty || saveInFlight || pendingRemoteSaveType != null || pendingSaveJobs.length > 0 || !projectSaved
  }

  function pauseAutoSave() {
    autoSaveEnabled = false
    const kept: PendingSaveJob[] = []
    for (const job of pendingSaveJobs) {
      if (job.type === 'MANUAL') kept.push(job)
      else job.resolve(false)
    }
    pendingSaveJobs = kept
    syncPendingFlag()
  }

  async function runJob(job: { snapshot: { rev: number }; type: SaveType }): Promise<boolean> {
    saveInFlight = true
    try {
      const ok = await persist(job.snapshot, job.type)
      if (ok) {
        projectSaved = true
        localDirty = false
      }
      else {
        projectSaved = false
      }
      return ok
    } finally {
      saveInFlight = false
    }
  }

  async function drain() {
    while (pendingSaveJobs.length) {
      const jobs = pendingSaveJobs.splice(0)
      syncPendingFlag()
      const type: SaveType = jobs.some((j) => j.type === 'MANUAL') ? 'MANUAL' : 'AUTO'
      if (type === 'AUTO' && !autoSaveEnabled) {
        jobs.forEach((j) => j.resolve(false))
        continue
      }
      const latest = jobs[jobs.length - 1]
      const ok = await runJob({ snapshot: latest.snapshot, type })
      jobs.forEach((j) => j.resolve(ok))
    }
  }

  async function flush(type: SaveType, snapshot: { rev: number }): Promise<boolean> {
    if (type === 'MANUAL') autoSaveEnabled = true
    else if (!autoSaveEnabled) return false
    if (saveInFlight) {
      return new Promise<boolean>((resolve) => {
        pendingSaveJobs.push({ projectId: 'P', snapshot, type, resolve })
        syncPendingFlag()
      })
    }
    const ok = await runJob({ snapshot, type })
    await drain()
    return ok
  }

  async function saveCanvasAndWait(type: SaveType, snapshot: { rev: number }): Promise<boolean> {
    // MANUAL 始终构建并等待当前快照，不得凭旧 saved 提前成功
    if (type === 'MANUAL') {
      localDirty = true
      projectSaved = false
      return flush('MANUAL', snapshot)
    }
    if (!hasUnsavedChanges()) return true
    return flush(type, snapshot)
  }

  return {
    markLocalCanvasChange,
    hasUnsavedChanges,
    pauseAutoSave,
    flush,
    saveCanvasAndWait,
    serverSnapshots,
    get pendingRemoteSaveType() {
      return pendingRemoteSaveType
    },
    get pendingCount() {
      return pendingSaveJobs.length
    },
    get projectSaved() {
      return projectSaved
    },
    get autoSaveEnabled() {
      return autoSaveEnabled
    },
    get saveInFlight() {
      return saveInFlight
    },
  }
}

test('修改后 0–279ms：同步 dirty，保存并离开不会因旧 saved 提前成功', async () => {
  const gate = createSaveGateModel()
  gate.markLocalCanvasChange()
  assert.equal(gate.hasUnsavedChanges(), true)
  assert.equal(gate.projectSaved, false)

  const ok = await gate.saveCanvasAndWait('MANUAL', { rev: 11 })
  assert.equal(ok, true)
  assert.deepEqual(gate.serverSnapshots, [{ rev: 11, type: 'MANUAL' }])
})

test('自动保存进行中再手动保存：排队保留快照，等待方拿到末次结果', async () => {
  let releaseFirst!: () => void
  const firstHold = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  let persistCount = 0
  const serverSnapshots: { rev: number; type: SaveType }[] = []

  const gate = createSaveGateModel({
    persist: async (snapshot, type) => {
      persistCount += 1
      if (persistCount === 1) await firstHold
      serverSnapshots.push({ rev: snapshot.rev, type })
      return true
    },
  })

  const autoPromise = gate.flush('AUTO', { rev: 1 })
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(gate.saveInFlight, true)

  const manualPromise = gate.saveCanvasAndWait('MANUAL', { rev: 2 })
  assert.equal(gate.pendingRemoteSaveType, 'MANUAL')

  releaseFirst()
  const [autoOk, manualOk] = await Promise.all([autoPromise, manualPromise])
  assert.equal(autoOk, true)
  assert.equal(manualOk, true)
  assert.deepEqual(serverSnapshots, [
    { rev: 1, type: 'AUTO' },
    { rev: 2, type: 'MANUAL' },
  ])
})

test('pagehide 发生在排队期间：只丢弃 AUTO，保留 MANUAL', async () => {
  let releaseFirst!: () => void
  const firstHold = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  let persistCount = 0
  const serverSnapshots: { rev: number; type: SaveType }[] = []

  const gate = createSaveGateModel({
    persist: async (snapshot, type) => {
      persistCount += 1
      if (persistCount === 1) await firstHold
      serverSnapshots.push({ rev: snapshot.rev, type })
      return true
    },
  })

  const first = gate.flush('AUTO', { rev: 0 })
  await Promise.resolve()
  await Promise.resolve()

  const queuedAuto = gate.flush('AUTO', { rev: 1 })
  const queuedManual = gate.saveCanvasAndWait('MANUAL', { rev: 9 })
  assert.equal(gate.pendingRemoteSaveType, 'MANUAL')

  gate.pauseAutoSave()
  assert.equal(gate.autoSaveEnabled, false)
  assert.equal(gate.pendingRemoteSaveType, 'MANUAL')

  releaseFirst()
  assert.equal(await first, true)
  assert.equal(await queuedAuto, false)
  assert.equal(await queuedManual, true)
  assert.ok(serverSnapshots.some((s) => s.rev === 9 && s.type === 'MANUAL'))
})

test('保存失败后禁止离开：saveCanvasAndWait 返回 false', async () => {
  const gate = createSaveGateModel({
    persist: async () => false,
  })
  gate.markLocalCanvasChange()
  const ok = await gate.saveCanvasAndWait('MANUAL', { rev: 3 })
  assert.equal(ok, false)
  assert.equal(gate.hasUnsavedChanges(), true)
})

test('MANUAL 不得仅凭旧 saved=true 提前成功', async () => {
  const gate = createSaveGateModel()
  assert.equal(gate.projectSaved, true)
  const ok = await gate.saveCanvasAndWait('MANUAL', { rev: 42 })
  assert.equal(ok, true)
  assert.deepEqual(gate.serverSnapshots, [{ rev: 42, type: 'MANUAL' }])
})
