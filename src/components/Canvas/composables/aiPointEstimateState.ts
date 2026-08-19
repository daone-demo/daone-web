export type AiPointEstimateState = {
  seq: number
  estimatedPoints: number | null
}

export function createAiPointEstimateState(): AiPointEstimateState {
  return { seq: 0, estimatedPoints: null }
}

/**
 * 参数变化：作废进行中的预估请求，但保留上一次有效积分，
 * 避免 UI 先回落静态占位再跳到新值（预估数字跳动）。
 */
export function invalidateAiPointEstimate(
  state: AiPointEstimateState,
): AiPointEstimateState {
  return { seq: state.seq + 1, estimatedPoints: state.estimatedPoints }
}

export function beginAiPointEstimateRequest(state: AiPointEstimateState): {
  state: AiPointEstimateState
  seq: number
} {
  const seq = state.seq + 1
  return { state: { ...state, seq }, seq }
}

export function parseEstimatedPoints(
  data: { estimatedPoints?: unknown } | null | undefined,
): number | null {
  const points = Number(data?.estimatedPoints)
  return Number.isFinite(points) ? points : null
}

/** 仅当前序列成功时写入；过期响应保持现有状态。 */
export function applyAiPointEstimateSuccess(
  state: AiPointEstimateState,
  resultSeq: number,
  data: { estimatedPoints?: unknown } | null | undefined,
): AiPointEstimateState {
  if (resultSeq !== state.seq) return state
  return { ...state, estimatedPoints: parseEstimatedPoints(data) }
}

/**
 * 当前序列失败时保留上一次有效预估（stale-while-revalidate）；
 * 从未成功预估过时仍为 null，由 UI 使用静态占位。
 * 过期失败不覆盖更新后的状态。
 */
export function applyAiPointEstimateFailure(
  state: AiPointEstimateState,
  resultSeq: number,
): AiPointEstimateState {
  if (resultSeq !== state.seq) return state
  return state
}

/** 主动清空（无能力码 / 无模型等不可预估场景）。 */
export function clearAiPointEstimate(
  state: AiPointEstimateState,
): AiPointEstimateState {
  return { ...state, estimatedPoints: null }
}
