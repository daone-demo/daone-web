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
