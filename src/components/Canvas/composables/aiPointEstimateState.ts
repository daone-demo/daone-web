export type AiPointEstimateState = {
  seq: number
  estimatedPoints: number | null
}

export function createAiPointEstimateState(): AiPointEstimateState {
  return { seq: 0, estimatedPoints: null }
}

/** 参数变化：立即丢掉旧积分，并作废进行中的预估请求。 */
export function invalidateAiPointEstimate(
  state: AiPointEstimateState,
): AiPointEstimateState {
  return { seq: state.seq + 1, estimatedPoints: null }
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

/** 仅当前序列失败/无效时回退静态占位（null）；过期失败不覆盖更新后的状态。 */
export function applyAiPointEstimateFailure(
  state: AiPointEstimateState,
  resultSeq: number,
): AiPointEstimateState {
  if (resultSeq !== state.seq) return state
  return { ...state, estimatedPoints: null }
}
