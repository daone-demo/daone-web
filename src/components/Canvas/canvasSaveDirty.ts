/**
 * 保存成功后是否清除 localDirty：仅当发起保存时的 change epoch
 * 与响应回来时一致，才认为这次快照覆盖了全部本地修改。
 */
export type CanvasSaveDirtyDecision = {
  localDirty: boolean
  projectSaved: boolean
  scheduleFollowUpSave: boolean
}

/** 乐观锁冲突业务码；保存层会静默对齐 revision 后重试 */
export const CANVAS_REVISION_CONFLICT_CODE = 'CANVAS_REVISION_CONFLICT'
/** 含首次请求在内的最多尝试次数（冲突时用最新 revision + 当前画布重试） */
export const CANVAS_REVISION_CONFLICT_MAX_ATTEMPTS = 3

/**
 * 从 CANVAS_REVISION_CONFLICT 错误中解析服务端最新 revision。
 * 兼容 number / 数字字符串；不依赖 request 模块，便于 Node 单测直接引用。
 */
export function parseCanvasLatestRevision(error: unknown): number | null {
  if (typeof error !== 'object' || error == null) return null
  const candidate = error as { code?: unknown; data?: unknown }
  if (candidate.code !== CANVAS_REVISION_CONFLICT_CODE) return null
  const data = candidate.data
  if (data == null || typeof data !== 'object') return null
  const raw = (data as { latestRevision?: unknown }).latestRevision
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function decideCanvasSaveDirty(
  saveEpoch: number,
  currentEpoch: number,
): CanvasSaveDirtyDecision {
  if ((currentEpoch || 0) === (saveEpoch || 0)) {
    return {
      localDirty: false,
      projectSaved: true,
      scheduleFollowUpSave: false,
    }
  }
  return {
    localDirty: true,
    projectSaved: false,
    scheduleFollowUpSave: true,
  }
}

/** 「保存并离开」最多跟刷几次最新快照，避免生成回填期间无限循环 */
export const MANUAL_SAVE_LEAVE_MAX_ATTEMPTS = 8
/** 与 waitForSaveSettled 默认上限对齐 */
export const MANUAL_SAVE_LEAVE_MAX_WAIT_MS = 30_000

export type ManualSaveLeaveNext = 'success' | 'fail' | 'continue'

/**
 * 手动保存（离开路径）在一次 flush 之后是否继续：
 * 只有 dirty / in-flight / pending 均已清空才允许离开。
 */
export function decideManualSaveLeaveNext(input: {
  flushOk: boolean
  stillDirty: boolean
  attempt: number
  maxAttempts: number
  elapsedMs: number
  maxWaitMs: number
}): ManualSaveLeaveNext {
  if (!input.flushOk) return 'fail'
  if (!input.stillDirty) return 'success'
  if (input.attempt >= input.maxAttempts) return 'fail'
  if (input.elapsedMs >= input.maxWaitMs) return 'fail'
  return 'continue'
}
