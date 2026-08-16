import type { Graph, Node } from '@antv/x6'
import {
  IMAGE_GENERAL_CAPABILITY_CODE,
  VIDEO_GENERAL_CAPABILITY_CODE,
  isAiGeneratedCanvasNode,
  resolveImageAssetId,
  resolveSubmittableCapabilityCode,
  type CanvasNodeData,
  type ImageDialogueSettings,
  type ImageSourceRef,
} from '../constants'
import { findIncomingTextNodes, plainTextFromNodeContent } from '../videoGen'
import { resolveAdvisorPromptFromTitle, resolveTitlePrefix } from './capabilityLabels'
import type { GroupAiReferenceContext, GroupAiTask } from './types'

export function findIncomingImageNodes(graph: Graph, targetNodeId: string): Node[] {
  const nodes: Node[] = []
  for (const edge of graph.getEdges()) {
    if (edge.getTargetCellId() !== targetNodeId) continue
    const sourceId = edge.getSourceCellId()
    if (!sourceId) continue
    const source = graph.getCellById(sourceId)
    if (!source?.isNode()) continue
    const data = source.getData() as CanvasNodeData
    if (data.kind !== 'image') continue
    if (!data.previewUrl?.trim() && data.imageGenState !== 'loading') continue
    nodes.push(source as Node)
  }
  return nodes
}

export function isImg2PromptTextNode(data: CanvasNodeData): boolean {
  if (data.textPickerTask === 'img2prompt') return true
  const title = data.title?.trim() || ''
  if (title === '反推提示词' || resolveTitlePrefix(title) === '反推提示词') return true
  const capabilityCode = data.generationParams?.capabilityCode?.trim()
  if (capabilityCode === 'IMAGE_PROMPT_REVERSE') return true
  return false
}

export function resolveIncomingTextPrompt(graph: Graph, nodeId: string): string {
  for (const textNode of findIncomingTextNodes(graph, nodeId)) {
    const data = textNode.getData() as CanvasNodeData
    const text = plainTextFromNodeContent(data.content)
    if (text) return text
  }
  return ''
}

/** 上游 AI 文本（含反推提示词）重新生成后的最新文案，供下游文生图作为 prompt */
export function resolveIncomingAiTextPrompt(graph: Graph, nodeId: string): string {
  for (const textNode of findIncomingTextNodes(graph, nodeId)) {
    const data = textNode.getData() as CanvasNodeData
    const text = plainTextFromNodeContent(data.content)
    if (!text) continue
    // 工作流导入后反推文本可能丢失 AI 标记，只要有正文即可作为下游 prompt
    if (isAiGeneratedCanvasNode(data) || isImg2PromptTextNode(data) || text.length > 0) {
      return text
    }
  }
  return ''
}

export function resolveReferenceAssetIdFromNode(
  graph: Graph,
  data: CanvasNodeData,
  scopeIds: Set<string>,
  finishedAssets: Map<string, string>,
): string {
  if (data.sourceNodeId && scopeIds.has(data.sourceNodeId)) {
    const finished = finishedAssets.get(data.sourceNodeId)
    if (finished) return finished
  }

  for (const ref of data.imageSourceRefs ?? []) {
    if (ref.nodeId && finishedAssets.get(ref.nodeId)) {
      return finishedAssets.get(ref.nodeId)!
    }
    if (ref.assetId) return ref.assetId
  }

  if (data.sourceNodeId) {
    const source = graph.getCellById(data.sourceNodeId)
    if (source?.isNode()) {
      const finished = finishedAssets.get(source.id)
      if (finished) return finished
      const assetId = resolveImageAssetId(source.getData() as CanvasNodeData)
      if (assetId) return assetId
    }
  }

  return resolveImageAssetId(data)
}

function resolveLiveAssetIdForRef(
  graph: Graph,
  ref: ImageSourceRef,
  finishedAssets: Map<string, string>,
): string {
  if (ref.nodeId) {
    const finished = finishedAssets.get(ref.nodeId)
    if (finished) return finished
    const cell = graph.getCellById(ref.nodeId)
    if (cell?.isNode()) {
      const live = resolveImageAssetId(cell.getData() as CanvasNodeData)
      if (live) return live
    }
  }
  return ref.assetId || ''
}

function buildSourceRefs(
  graph: Graph,
  node: Node,
  _scopeIds: Set<string>,
  finishedAssets: Map<string, string>,
): ImageSourceRef[] {
  const data = node.getData() as CanvasNodeData
  const refs: ImageSourceRef[] = []

  const appendRef = (sourceNode: Node) => {
    const sourceData = sourceNode.getData() as CanvasNodeData
    const assetId = finishedAssets.get(sourceNode.id) || resolveImageAssetId(sourceData)
    refs.push({
      nodeId: sourceNode.id,
      assetId,
      previewUrl: sourceData.previewUrl,
      fileName: sourceData.fileName || sourceData.title || '',
    })
  }

  const incoming = findIncomingImageNodes(graph, node.id)
  incoming.forEach((sourceNode) => {
    appendRef(sourceNode)
  })

  if (!refs.length && data.sourceNodeId) {
    const source = graph.getCellById(data.sourceNodeId)
    if (source?.isNode()) appendRef(source as Node)
  }

  if (!refs.length && data.imageSourceRefs?.length) {
    return data.imageSourceRefs.map((ref) => ({
      ...ref,
      assetId: resolveLiveAssetIdForRef(graph, ref, finishedAssets),
    }))
  }

  return refs
}

/**
 * 整组执行时优先用上游最新 assetId（含本轮刚完成的 finishedAssets），
 * 避免继续使用 generationParams 里过期的 referenceAssetIds。
 */
function resolveLiveReferenceAssetIds(
  graph: Graph,
  data: CanvasNodeData,
  sourceRefs: ImageSourceRef[],
  scopeIds: Set<string>,
  finishedAssets: Map<string, string>,
  savedParams?: CanvasNodeData['generationParams'],
): string[] {
  const liveFromRefs = [
    ...new Set(sourceRefs.map((ref) => ref.assetId).filter((id): id is string => Boolean(id))),
  ]
  if (liveFromRefs.length) return liveFromRefs

  const fallback = resolveReferenceAssetIdFromNode(graph, data, scopeIds, finishedAssets)
  if (fallback) return [fallback]

  const saved = (savedParams?.referenceAssetIds ?? []).filter((id): id is string => Boolean(id))
  return [...new Set(saved)]
}

function withPrimaryAssetId(
  parameters: Record<string, unknown>,
  primaryAssetId?: string,
): Record<string, unknown> {
  if (!primaryAssetId) return { ...parameters }
  return { ...parameters, assetId: primaryAssetId }
}

/** 在组内查找文本节点连出的 AI 结果节点（整组执行时原地重跑，不新建） */
export function findGroupOutgoingAiResultNode(
  graph: Graph,
  sourceNodeId: string,
  scopeIds: Set<string>,
  kind: 'image' | 'video',
): Node | null {
  let candidate: Node | null = null
  for (const edge of graph.getEdges()) {
    if (edge.getSourceCellId() !== sourceNodeId) continue
    const targetId = edge.getTargetCellId()
    if (!targetId || !scopeIds.has(targetId)) continue
    const target = graph.getCellById(targetId)
    if (!target?.isNode()) continue
    const data = target.getData() as CanvasNodeData
    if (data.kind !== kind) continue
    if (!isAiGeneratedCanvasNode(data) && data.title !== '文生图' && data.title !== '文生视频') {
      continue
    }
    candidate = target as Node
  }
  return candidate
}

export function resolveGroupAiReferenceContext(
  graph: Graph,
  node: Node,
  task: GroupAiTask,
  scopeIds: Set<string>,
  finishedAssets: Map<string, string>,
): GroupAiReferenceContext | null {
  const data = node.getData() as CanvasNodeData
  const savedParams = data.generationParams
  const sourceRefs = buildSourceRefs(graph, node, scopeIds, finishedAssets)
  const referenceAssetIds = resolveLiveReferenceAssetIds(
    graph,
    data,
    sourceRefs,
    scopeIds,
    finishedAssets,
    savedParams,
  )
  const primaryAssetId = referenceAssetIds[0]

  const incomingTextPrompt = resolveIncomingTextPrompt(graph, node.id)
  // 整组执行：文生图优先使用上游 AI 反推/文本节点最新 content，避免沿用节点旧 prompt
  const incomingAiTextPrompt =
    task.kind === 'imageDialogue' || task.kind === 'text2image'
      ? resolveIncomingAiTextPrompt(graph, node.id)
      : ''

  const advisorPrompt = resolveAdvisorPromptFromTitle(data.title || data.fileName || '')
  const prompt =
    incomingAiTextPrompt ||
    savedParams?.prompt?.trim() ||
    data.imageDialogueText?.trim() ||
    data.genPrompt?.trim() ||
    data.videoDialogueText?.trim() ||
    incomingTextPrompt ||
    advisorPrompt ||
    ''

  if (task.kind === 'imageCapability' || task.kind === 'imageDialogue') {
    if (task.kind === 'imageCapability') {
      if (!referenceAssetIds.length) return null
      return {
        referenceAssetIds,
        sourceRefs,
        prompt,
        parameters: withPrimaryAssetId({ ...(savedParams?.parameters ?? {}) }, primaryAssetId),
        taskTitle: resolveTitlePrefix(data.title) || data.title || '生成',
        capabilityCode: resolveSubmittableCapabilityCode(
          savedParams?.capabilityCode || task.capabilityCode,
          IMAGE_GENERAL_CAPABILITY_CODE,
        ),
      }
    }

    // 文生图允许无参考图；图生图优先用已保存参数，但参考图始终取上游最新
    // 工作流导入节点可能仅有参考图、缺少 prompt：有参考图时仍允许执行
    if (!prompt && !savedParams && !referenceAssetIds.length) return null

    const settings = data.imageDialogueSettings
    const parameters = withPrimaryAssetId(
      {
        ...(savedParams?.parameters ?? {}),
        model: savedParams?.parameters?.model ?? settings?.modelKey,
        aspectRatio: savedParams?.parameters?.aspectRatio ?? settings?.aspectRatio,
        count: Math.max(
          1,
          Math.floor(Number(savedParams?.parameters?.count ?? settings?.imageCount)) || 1,
        ),
        ...((savedParams?.parameters?.resolution ?? settings?.resolution)
          ? {
              resolution: savedParams?.parameters?.resolution ?? settings?.resolution,
            }
          : {}),
      },
      primaryAssetId,
    )

    return {
      referenceAssetIds,
      sourceRefs,
      prompt,
      parameters,
      settings: settings as ImageDialogueSettings | undefined,
      workflowId: savedParams?.workflowId ?? settings?.workflowId,
      taskTitle: data.title || '文生图',
      capabilityCode: resolveSubmittableCapabilityCode(
        savedParams?.capabilityCode,
        IMAGE_GENERAL_CAPABILITY_CODE,
      ),
    }
  }

  if (task.kind === 'textImg2Prompt') {
    if (!referenceAssetIds.length) return null
    const reversePrompt = data.genPrompt?.trim() || ''
    return {
      referenceAssetIds,
      sourceRefs,
      prompt: reversePrompt,
      parameters: {
        assetId: primaryAssetId,
        prompt: reversePrompt,
      },
      taskTitle: '反推提示词',
      capabilityCode: 'IMAGE_PROMPT_REVERSE',
    }
  }

  if (task.kind === 'textCopy') {
    return {
      referenceAssetIds,
      sourceRefs,
      prompt: data.genPrompt?.trim() || '',
      parameters: { style: 'creative' },
      taskTitle: '自由创作',
      capabilityCode: 'TEXT_COPY_V1',
    }
  }

  if (task.kind === 'text2image') {
    if (!prompt && !savedParams) return null
    return {
      referenceAssetIds,
      sourceRefs,
      prompt: prompt || data.imageDialogueText?.trim() || data.genPrompt?.trim() || '',
      parameters: withPrimaryAssetId(
        {
          ...(savedParams?.parameters ?? {}),
          model: savedParams?.parameters?.model ?? data.imageDialogueSettings?.modelKey,
          aspectRatio:
            savedParams?.parameters?.aspectRatio ?? data.imageDialogueSettings?.aspectRatio,
          count: Math.max(
            1,
            Math.floor(
              Number(savedParams?.parameters?.count ?? data.imageDialogueSettings?.imageCount),
            ) || 1,
          ),
          resolution: savedParams?.parameters?.resolution ?? data.imageDialogueSettings?.resolution,
        },
        primaryAssetId,
      ),
      settings: data.imageDialogueSettings as ImageDialogueSettings | undefined,
      workflowId: savedParams?.workflowId ?? data.imageDialogueSettings?.workflowId,
      taskTitle: '文生图',
      capabilityCode: resolveSubmittableCapabilityCode(
        savedParams?.capabilityCode,
        IMAGE_GENERAL_CAPABILITY_CODE,
      ),
    }
  }

  if (task.kind === 'text2video' || task.kind === 'videoDialogue') {
    if (!prompt && !savedParams) return null
    const settings = data.videoDialogueSettings
    return {
      referenceAssetIds,
      sourceRefs,
      prompt,
      parameters: withPrimaryAssetId(
        {
          ...(savedParams?.parameters ?? {}),
          mode: savedParams?.parameters?.mode ?? settings?.mode ?? 'text-to-video',
          model: savedParams?.parameters?.model ?? settings?.modelKey,
          ratio: savedParams?.parameters?.ratio ?? settings?.aspectRatio,
          clarity: savedParams?.parameters?.clarity ?? settings?.resolution,
          duration: savedParams?.parameters?.duration ?? settings?.duration,
          generateAudio: savedParams?.parameters?.generateAudio ?? settings?.generateAudio,
          videoCount: savedParams?.parameters?.videoCount ?? settings?.videoCount,
        },
        primaryAssetId,
      ),
      taskTitle: task.kind === 'text2video' ? '文生视频' : '视频生成',
      capabilityCode: resolveSubmittableCapabilityCode(
        savedParams?.capabilityCode,
        VIDEO_GENERAL_CAPABILITY_CODE,
      ),
    }
  }

  return null
}
