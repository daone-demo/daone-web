import { computed, onBeforeUnmount, ref, watch } from 'vue'
import api, { type PointEstimateResponse } from '@/services/api'

export type AiPointEstimateRequest = {
  capabilityCode: string
  parameters: Record<string, unknown>
}

/**
 * 按能力码 + parameters 动态预估积分。
 * 失败时静默回退到静态占位值，不影响现有发送流程。
 */
export function useAiPointEstimate(options: {
  fallbackLabel: string
  getRequest: () => AiPointEstimateRequest | null
}) {
  const estimatedPoints = ref<number | null>(null)
  const estimatedCreditsLabel = computed(() => {
    if (estimatedPoints.value != null && Number.isFinite(estimatedPoints.value)) {
      return String(estimatedPoints.value)
    }
    return options.fallbackLabel
  })

  let estimateSeq = 0
  let estimateTimer: ReturnType<typeof setTimeout> | undefined

  const estimateSignature = computed(() => {
    const request = options.getRequest()
    if (!request?.capabilityCode) return ''
    return JSON.stringify(request)
  })

  async function refreshPointEstimate() {
    const seq = ++estimateSeq
    if (!estimateSignature.value) return
    let payload: AiPointEstimateRequest
    try {
      payload = JSON.parse(estimateSignature.value) as AiPointEstimateRequest
    } catch {
      return
    }
    if (!payload.capabilityCode || !payload.parameters?.model) return

    try {
      const data = await api.estimateAiPoints(
        {
          capabilityCode: payload.capabilityCode,
          parameters: payload.parameters,
        },
        { silent: true },
      )
      if (seq !== estimateSeq) return
      const points = Number((data as PointEstimateResponse | null | undefined)?.estimatedPoints)
      estimatedPoints.value = Number.isFinite(points) ? points : null
    } catch {
      if (seq !== estimateSeq) return
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
      schedulePointEstimate()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (estimateTimer) clearTimeout(estimateTimer)
    estimateSeq += 1
  })

  return {
    estimatedPoints,
    estimatedCreditsLabel,
    refreshPointEstimate,
  }
}
