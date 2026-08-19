/**
 * 保存成功后是否清除 localDirty：仅当发起保存时的 change epoch
 * 与响应回来时一致，才认为这次快照覆盖了全部本地修改。
 */
export type CanvasSaveDirtyDecision = {
  localDirty: boolean
  projectSaved: boolean
  scheduleFollowUpSave: boolean
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
