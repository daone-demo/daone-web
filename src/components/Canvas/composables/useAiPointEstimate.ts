import { computed, onBeforeUnmount, ref, watch } from 'vue'
import api, { type PointEstimateResponse } from '@/services/api'
import {
  applyAiPointEstimateFailure,
  applyAiPointEstimateSuccess,
  beginAiPointEstimateRequest,
  clearAiPointEstimate,
  createAiPointEstimateState,
  invalidateAiPointEstimate,
  type AiPointEstimateState,
} from './aiPointEstimateState'

export type AiPointEstimateRequest = {
  capabilityCode: string
  parameters: Record<string, unknown>
}

/**
 * 按能力码 + parameters 动态预估积分。
 * 参数变化时保留上一次有效积分直至新请求返回，避免数字跳动；
 * 从未成功预估过时仍使用静态占位，不影响现有发送流程。
 */
export function useAiPointEstimate(options: {
  fallbackLabel: string
  getRequest: () => AiPointEstimateRequest | null
}) {
  let state = createAiPointEstimateState()
  const estimatedPoints = ref<number | null>(state.estimatedPoints)
  const estimatedCreditsLabel = computed(() => {
    if (estimatedPoints.value != null && Number.isFinite(estimatedPoints.value)) {
      return String(estimatedPoints.value)
    }
    return options.fallbackLabel
  })

  let estimateTimer: ReturnType<typeof setTimeout> | undefined

  function commit(next: AiPointEstimateState) {
    state = next
    estimatedPoints.value = state.estimatedPoints
  }

  const estimateSignature = computed(() => {
    const request = options.getRequest()
    if (!request?.capabilityCode) return ''
    return JSON.stringify(request)
  })

  async function refreshPointEstimate() {
    const started = beginAiPointEstimateRequest(state)
    commit(started.state)
    const seq = started.seq
    if (!estimateSignature.value) {
      commit(clearAiPointEstimate(state))
      return
    }
    let payload: AiPointEstimateRequest
    try {
      payload = JSON.parse(estimateSignature.value) as AiPointEstimateRequest
    } catch {
      commit(clearAiPointEstimate(state))
      return
    }
    if (!payload.capabilityCode || !payload.parameters?.model) {
      commit(clearAiPointEstimate(state))
      return
    }

    try {
      const data = await api.estimateAiPoints(
        {
          capabilityCode: payload.capabilityCode,
          parameters: payload.parameters,
        },
        { silent: true },
      )
      commit(
        applyAiPointEstimateSuccess(
          state,
          seq,
          data as PointEstimateResponse | null | undefined,
        ),
      )
    } catch {
      commit(applyAiPointEstimateFailure(state, seq))
    }
  }

  function schedulePointEstimate() {
    if (estimateTimer) clearTimeout(estimateTimer)
    estimateTimer = setTimeout(() => {
      void refreshPointEstimate()
    }, 300)
  }

  watch(
    estimateSignature,
    () => {
      commit(invalidateAiPointEstimate(state))
      schedulePointEstimate()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (estimateTimer) clearTimeout(estimateTimer)
    commit(invalidateAiPointEstimate(state))
  })

  return {
    estimatedPoints,
    estimatedCreditsLabel,
    refreshPointEstimate,
  }
}
