import { computed, type Ref } from 'vue'
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

function resolveImageCount(value: number) {
  return Math.max(1, Math.floor(Number(value)) || 1)
}

/** 与创建图片对话任务同源的 parameters（单张 count=1，展示时再乘张数） */
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
    count: resolveImageCount(input.imageCount),
  }
  if (input.resolution) {
    parameters.resolution = input.resolution
  }
  applyImageMarkTaskParameters(parameters, input.elementMarks, input.prompt.trim())
  return parameters
}

/**
 * 按模型 / 宽高比 / 分辨率 / 张数 / 标记内容动态预估积分。
 * 接口按单张任务计价（与创建任务 count=1 一致），展示时再乘以数量。
 */
export function useImageDialoguePointEstimate(input: EstimateParamsInput) {
  const estimate = useAiPointEstimate({
    fallbackLabel: IMAGE_DIALOGUE_CREDITS,
    getRequest: () => ({
      capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
      parameters: buildImageDialogueEstimateParameters({
        modelKey: input.modelKey.value,
        aspectRatio: input.aspectRatio.value,
        resolution: input.resolution.value,
        imageCount: 1,
        prompt: readRefOrGetter(input.prompt),
        elementMarks: readRefOrGetter(input.elementMarks),
        chatTools: readRefOrGetter(input.chatTools),
      }),
    }),
  })

  const estimatedCreditsLabel = computed(() => {
    const count = resolveImageCount(input.imageCount.value)
    const base =
      estimate.estimateStatus.value === 'ready' ? estimate.estimatedPoints.value : null
    if (base != null && Number.isFinite(base)) {
      return String(base * count)
    }
    const fallback = Number.parseInt(IMAGE_DIALOGUE_CREDITS, 10)
    return Number.isFinite(fallback) ? String(fallback * count) : IMAGE_DIALOGUE_CREDITS
  })

  return {
    ...estimate,
    estimatedCreditsLabel,
  }
}
