import { computed } from 'vue'
import {
  resolveVideoDialogueModelApiValue,
  resolveVideoGenApiMode,
  toVideoApiClarity,
  VIDEO_DIALOGUE_CREDITS,
  VIDEO_GENERAL_CAPABILITY_CODE,
  type ChatTools,
  type VideoDialogueMode,
} from '../constants'
import { applyVideoFirstLastFrameParameters, type VideoSourceRef } from '../videoGen'
import { useAiPointEstimate } from './useAiPointEstimate'

function collectVideoImageAssetIds(sourceRefs?: VideoSourceRef[]) {
  return (sourceRefs ?? [])
    .filter((ref) => ref.kind !== 'text')
    .map((ref) => String(ref.assetId ?? '').trim())
    .filter(Boolean)
}

/** 与创建视频生成任务同源的 parameters（含条数，用于整次预估） */
export function buildVideoGenEstimateParameters(input: {
  modelKey: string
  ratio: string
  resolution: string
  duration: number
  generateAudio: boolean
  videoCount: number
  mode: VideoDialogueMode
  sourceRefs?: VideoSourceRef[]
  chatTools?: ChatTools | null
}): Record<string, unknown> {
  const imageAssetIds = collectVideoImageAssetIds(input.sourceRefs)
  const parameters: Record<string, unknown> = {
    mode: input.mode,
    model: resolveVideoDialogueModelApiValue(input.modelKey, input.chatTools),
    ratio: input.ratio,
    clarity: toVideoApiClarity(input.resolution),
    duration: input.duration,
    generateAudio: input.generateAudio,
    videoCount: Math.max(1, Math.floor(Number(input.videoCount)) || 1),
  }
  if (imageAssetIds[0]) {
    parameters.assetId = imageAssetIds[0]
  }
  return applyVideoFirstLastFrameParameters(parameters, input.mode, imageAssetIds)
}

function resolveVideoCount(value: number) {
  return Math.max(1, Math.floor(Number(value)) || 1)
}

/**
 * 按模型 / 比例 / 清晰度 / 时长 / 条数 / 模式与参考内容动态预估积分。
 * 接口按单条任务计价（与创建任务 videoCount=1 一致），展示时再乘以数量。
 */
export function useVideoGenPointEstimate(input: {
  modelKey: () => string
  ratio: () => string
  resolution: () => string
  duration: () => number
  generateAudio: () => boolean
  videoCount: () => number
  chatTools: () => ChatTools | null | undefined
  mode?: () => VideoDialogueMode
  tab?: () => string
  sourceRefs?: () => VideoSourceRef[] | undefined
}) {
  const estimate = useAiPointEstimate({
    fallbackLabel: VIDEO_DIALOGUE_CREDITS,
    getRequest: () => ({
      capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
      parameters: buildVideoGenEstimateParameters({
        modelKey: input.modelKey(),
        ratio: input.ratio(),
        resolution: input.resolution(),
        duration: input.duration(),
        generateAudio: input.generateAudio(),
        videoCount: 1,
        mode: input.mode?.() ?? resolveVideoGenApiMode(input.tab?.() ?? 'text2video'),
        sourceRefs: input.sourceRefs?.(),
        chatTools: input.chatTools(),
      }),
    }),
  })

  const estimatedCreditsLabel = computed(() => {
    const count = resolveVideoCount(input.videoCount())
    const base = estimate.estimateStatus.value === 'ready' ? estimate.estimatedPoints.value : null
    if (base != null && Number.isFinite(base)) {
      return String(base * count)
    }
    const fallback = Number.parseInt(VIDEO_DIALOGUE_CREDITS, 10)
    return Number.isFinite(fallback) ? String(fallback * count) : VIDEO_DIALOGUE_CREDITS
  })

  return {
    ...estimate,
    estimatedCreditsLabel,
  }
}
