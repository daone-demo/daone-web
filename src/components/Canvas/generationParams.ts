import type { Node } from '@antv/x6'
import type {
  CanvasGenerationParams,
  CanvasNodeData,
  ImageDialogueSettings,
  ImageDialogueSubmitPayload,
  ImageMarkItem,
  ImageSourceRef,
  VideoDialogueSettings,
  VideoDialogueSubmitPayload,
} from './constants'
import {
  normalizeImageDialogueSettingsForModel,
  pickImageDialogueSettingsInput,
} from './constants'

export type NodeGenerationSnapshot = CanvasGenerationParams & {
  imageDialogueText?: string
  imageDialogueSettings?: Partial<ImageDialogueSettings>
  videoDialogueText?: string
  videoDialogueSettings?: Partial<VideoDialogueSettings>
  imageSourceRefs?: ImageSourceRef[]
  videoSourceRefs?: ImageSourceRef[]
  elementMarks?: ImageMarkItem[]
  genPrompt?: string
  genSeed?: number
}

export function buildImageGenerationParams(input: {
  prompt: string
  parameters: Record<string, unknown>
  capabilityCode: string
  workflowId?: string | number
  referenceAssetIds?: string[]
}): CanvasGenerationParams {
  return {
    taskType: 'IMAGE',
    capabilityCode: input.capabilityCode,
    prompt: input.prompt.trim(),
    parameters: { ...input.parameters },
    ...(input.workflowId !== undefined && input.workflowId !== '' ? { workflowId: input.workflowId } : {}),
    ...(input.referenceAssetIds?.length ? { referenceAssetIds: [...input.referenceAssetIds] } : {}),
  }
}

export function buildVideoGenerationParams(input: {
  prompt: string
  parameters: Record<string, unknown>
  capabilityCode: string
  referenceAssetIds?: string[]
}): CanvasGenerationParams {
  return {
    taskType: 'VIDEO',
    capabilityCode: input.capabilityCode,
    prompt: input.prompt.trim(),
    parameters: { ...input.parameters },
    ...(input.referenceAssetIds?.length ? { referenceAssetIds: [...input.referenceAssetIds] } : {}),
  }
}

export function buildTextGenerationParams(input: {
  prompt: string
  parameters: Record<string, unknown>
  capabilityCode: string
}): CanvasGenerationParams {
  return {
    taskType: 'TEXT',
    capabilityCode: input.capabilityCode,
    prompt: input.prompt.trim(),
    parameters: { ...input.parameters },
  }
}

export function buildModelGenerationParams(input: {
  prompt: string
  parameters: Record<string, unknown>
  capabilityCode: string
  referenceAssetIds?: string[]
}): CanvasGenerationParams {
  return {
    taskType: 'MODEL',
    capabilityCode: input.capabilityCode,
    prompt: input.prompt.trim(),
    parameters: { ...input.parameters },
    ...(input.referenceAssetIds?.length ? { referenceAssetIds: [...input.referenceAssetIds] } : {}),
  }
}

export function imageDialogueSettingsFromPayload(
  payload?: Partial<ImageDialogueSubmitPayload>,
): Partial<ImageDialogueSettings> {
  if (!payload) return {}
  return {
    aspectRatio: payload.aspectRatio ?? '',
    resolution: payload.resolution ?? '',
    imageCount: payload.count ?? 1,
    modelKey: payload.model ?? '',
    workflowId: String(payload.workflowId ?? payload.workflow?.id ?? ''),
  }
}

export function videoDialogueSettingsFromPayload(
  payload: Partial<VideoDialogueSubmitPayload>,
): Partial<VideoDialogueSettings> {
  return {
    modelKey: payload.model ?? '',
    aspectRatio: (payload.ratio as VideoDialogueSettings['aspectRatio']) ?? '16:9',
    resolution: (payload.clarity as VideoDialogueSettings['resolution']) ?? '720p',
    duration: (payload.duration as VideoDialogueSettings['duration']) ?? 5,
    generateAudio: payload.generateAudio ?? false,
    videoCount: payload.videoCount ?? 1,
    mode: payload.mode ?? 'text-to-video',
  }
}

/** 将完整生成参数与对话溯源字段写入节点 data */
export function persistNodeGenerationSnapshot(node: Node, snapshot: NodeGenerationSnapshot) {
  const data = { ...(node.getData() as CanvasNodeData) }
  const {
    taskType,
    capabilityCode,
    prompt,
    parameters,
    workflowId,
    referenceAssetIds,
    imageDialogueText,
    imageDialogueSettings,
    videoDialogueText,
    videoDialogueSettings,
    imageSourceRefs,
    videoSourceRefs,
    elementMarks,
    genPrompt,
    genSeed,
  } = snapshot

  data.generationParams = {
    taskType,
    capabilityCode,
    prompt: prompt.trim(),
    parameters: { ...parameters },
    ...(workflowId !== undefined && workflowId !== '' ? { workflowId } : {}),
    ...(referenceAssetIds?.length ? { referenceAssetIds: [...referenceAssetIds] } : {}),
  }
  data.generationTaskType = taskType

  const trimmedPrompt = prompt.trim()
  if (trimmedPrompt) {
    data.genPrompt = genPrompt?.trim() || trimmedPrompt
    if (taskType === 'IMAGE') {
      data.imageDialogueText = imageDialogueText?.trim() || trimmedPrompt
    }
    if (taskType === 'VIDEO') {
      data.videoDialogueText = videoDialogueText?.trim() || trimmedPrompt
    }
  } else if (genPrompt?.trim()) {
    data.genPrompt = genPrompt.trim()
  }

  if (imageDialogueSettings) {
    data.imageDialogueSettings = normalizeImageDialogueSettingsForModel(
      pickImageDialogueSettingsInput(imageDialogueSettings),
    )
  }
  if (videoDialogueSettings) {
    data.videoDialogueSettings = { ...videoDialogueSettings } as VideoDialogueSettings
  }
  if (imageSourceRefs?.length) {
    data.imageSourceRefs = imageSourceRefs.map((item) => ({ ...item }))
    const latest = data.imageSourceRefs[data.imageSourceRefs.length - 1]
    if (latest) {
      data.sourceNodeId = latest.nodeId
      data.sourcePreviewUrl = latest.previewUrl
      data.sourceFileName = latest.fileName
      data.sourceAssetId = latest.assetId
    }
    data.inputUpdated = data.imageSourceRefs.some((item) => Boolean(item.previewUrl?.trim()))
  }
  if (videoSourceRefs?.length) {
    data.videoSourceRefs = videoSourceRefs.map((item) => ({ ...item }))
  }
  if (elementMarks?.length) {
    data.elementMarks = elementMarks.map((mark) => ({ ...mark }))
  }
  if (genSeed !== undefined) {
    data.genSeed = genSeed
  }

  node.setData(data, { overwrite: true })
}
