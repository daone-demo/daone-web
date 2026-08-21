export type AiPointEstimateStatus = 'idle' | 'loading' | 'ready' | 'error'

export type AiPointEstimateState = {
  seq: number
  estimatedPoints: number | null
  status: AiPointEstimateStatus
}

export function createAiPointEstimateState(): AiPointEstimateState {
  return { seq: 0, estimatedPoints: null, status: 'idle' }
}

/**
 * 参数变化：作废进行中的预估，并清空旧积分（进入 loading）。
 * 不得把上一组参数价格继续展示为当前结果。
 */
export function invalidateAiPointEstimate(
  state: AiPointEstimateState,
): AiPointEstimateState {
  return { seq: state.seq + 1, estimatedPoints: null, status: 'loading' }
}

export function beginAiPointEstimateRequest(state: AiPointEstimateState): {
  state: AiPointEstimateState
  seq: number
} {
  const seq = state.seq + 1
  return {
    state: { ...state, seq, estimatedPoints: null, status: 'loading' },
    seq,
  }
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
  return {
    ...state,
    estimatedPoints: parseEstimatedPoints(data),
    status: 'ready',
  }
}

/**
 * 当前序列失败：清空积分并标记 error，UI 使用静态兜底，不得展示旧参数价格。
 * 过期失败不覆盖更新后的状态。
 */
export function applyAiPointEstimateFailure(
  state: AiPointEstimateState,
  resultSeq: number,
): AiPointEstimateState {
  if (resultSeq !== state.seq) return state
  return { ...state, estimatedPoints: null, status: 'error' }
}

/** 主动清空（无能力码 / 无模型等不可预估场景）。 */
export function clearAiPointEstimate(
  state: AiPointEstimateState,
): AiPointEstimateState {
  return { ...state, estimatedPoints: null, status: 'idle' }
}
