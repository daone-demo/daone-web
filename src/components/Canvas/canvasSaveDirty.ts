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
/**
 * 含首次请求在内的最多尝试次数。
 * 覆盖：revision 冲突对齐重试、偶发网络超时重试。
 */
export const CANVAS_REVISION_CONFLICT_MAX_ATTEMPTS = 3

/**
 * 画布 GET/PUT 体量大且常经远程代理，单独放宽超时（默认全局 60s 不够稳）。
 * 仍可通过 RequestConfig.timeout 覆盖。
 */
export const CANVAS_HTTP_TIMEOUT_MS = 120_000

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

/** axios / 代理层超时（无业务码，通常为 ECONNABORTED） */
export function isCanvasRequestTimeout(error: unknown): boolean {
  if (typeof error !== 'object' || error == null) return false
  const candidate = error as { code?: unknown; message?: unknown }
  if (candidate.code === 'ECONNABORTED') return true
  if (typeof candidate.message === 'string' && /timeout/i.test(candidate.message)) return true
  return false
}

export type CanvasSaveRetryKind = 'conflict' | 'timeout' | null

/**
 * 判定本次保存失败是否可重试，以及重试前是否需要对齐 revision。
 * 非冲突/非超时错误返回 kind=null，调用方应原样抛出。
 */
export function decideCanvasSaveRetry(error: unknown): {
  kind: CanvasSaveRetryKind
  latestRevision: number | null
} {
  const latestRevision = parseCanvasLatestRevision(error)
  if (latestRevision != null) {
    return { kind: 'conflict', latestRevision }
  }
  if (isCanvasRequestTimeout(error)) {
    return { kind: 'timeout', latestRevision: null }
  }
  return { kind: null, latestRevision: null }
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
