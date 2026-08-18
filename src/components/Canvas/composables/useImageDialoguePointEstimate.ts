import { type Ref } from 'vue'
import {
  IMAGE_DIALOGUE_CREDITS,
  IMAGE_GENERAL_CAPABILITY_CODE,
  resolveImageDialogueModelApiValue,
  type ChatTools,
  type ImageMarkItem,
} from '../constants'
import { applyImageMarkTaskParameters } from '../imageMarkUtils'
import { useAiPointEstimate } from './useAiPointEstimate'

type EstimateParamsInput = {
  modelKey: Ref<string>
  aspectRatio: Ref<string>
  resolution: Ref<string>
  imageCount: Ref<number>
  prompt: Ref<string> | (() => string)
  elementMarks: Ref<ImageMarkItem[] | undefined> | (() => ImageMarkItem[] | undefined)
  chatTools: Ref<ChatTools | null | undefined> | (() => ChatTools | null | undefined)
}

function readRefOrGetter<T>(source: Ref<T> | (() => T)): T {
  return typeof source === 'function' ? source() : source.value
}

/** 与创建图片对话任务同源的 parameters（含张数，用于整次预估） */
export function buildImageDialogueEstimateParameters(input: {
  modelKey: string
  aspectRatio: string
  resolution: string
  imageCount: number
  prompt: string
  elementMarks?: ImageMarkItem[]
  chatTools?: ChatTools | null
}): Record<string, unknown> {
  const parameters: Record<string, unknown> = {
    model: resolveImageDialogueModelApiValue(input.modelKey, input.chatTools),
    aspectRatio: input.aspectRatio,
    count: Math.max(1, Math.floor(Number(input.imageCount)) || 1),
  }
  if (input.resolution) {
    parameters.resolution = input.resolution
  }
  applyImageMarkTaskParameters(parameters, input.elementMarks, input.prompt.trim())
  return parameters
}

/**
 * 按模型 / 宽高比 / 分辨率 / 张数 / 标记内容动态预估积分。
 * 失败时静默回退到静态占位值，不影响现有发送流程。
 */
export function useImageDialoguePointEstimate(input: EstimateParamsInput) {
  return useAiPointEstimate({
    fallbackLabel: IMAGE_DIALOGUE_CREDITS,
    getRequest: () => ({
      capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
      parameters: buildImageDialogueEstimateParameters({
        modelKey: input.modelKey.value,
        aspectRatio: input.aspectRatio.value,
        resolution: input.resolution.value,
        imageCount: input.imageCount.value,
        prompt: readRefOrGetter(input.prompt),
        elementMarks: readRefOrGetter(input.elementMarks),
        chatTools: readRefOrGetter(input.chatTools),
      }),
    }),
  })
}
