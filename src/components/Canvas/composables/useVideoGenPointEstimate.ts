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

/**
 * 按模型 / 比例 / 清晰度 / 时长 / 条数 / 模式与参考内容动态预估积分。
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
  return useAiPointEstimate({
    fallbackLabel: VIDEO_DIALOGUE_CREDITS,
    getRequest: () => ({
      capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
      parameters: buildVideoGenEstimateParameters({
        modelKey: input.modelKey(),
        ratio: input.ratio(),
        resolution: input.resolution(),
        duration: input.duration(),
        generateAudio: input.generateAudio(),
        videoCount: input.videoCount(),
        mode: input.mode?.() ?? resolveVideoGenApiMode(input.tab?.() ?? 'text2video'),
        sourceRefs: input.sourceRefs?.(),
        chatTools: input.chatTools(),
      }),
    }),
  })
}
