import type { Graph, Node } from '@antv/x6'
import {
  GROUP_EXECUTE_IMG2PROMPT_CREDITS,
  GROUP_EXECUTE_TEXT_COPY_CREDITS,
  IMAGE_DIALOGUE_CREDITS,
  IMAGE_GENERAL_CAPABILITY_CODE,
  IMAGE_NODE_TOOLBAR,
  VIDEO_DIALOGUE_CREDITS,
  VIDEO_GENERAL_CAPABILITY_CODE,
  isAiGeneratedCanvasNode,
  isVideoNodeGenerating,
  resolveImageAssetId,
  type CanvasNodeData,
  type ImageDialogueSettings,
  type ImageSourceRef,
} from './constants'
import { getGroupBoxNodeIds } from './nodeGroup'
import { syncTextNodeImageSource } from './textPrompt'
import { findIncomingTextNodes, plainTextFromNodeContent } from './videoGen'

export type GroupAiTaskKind =
  | 'imageCapability'
  | 'imageDialogue'
  | 'textImg2Prompt'
  | 'textCopy'
  | 'text2image'
  | 'text2video'
  | 'videoDialogue'

export interface GroupAiTask {
  nodeId: string
  kind: GroupAiTaskKind
  capabilityCode: string
  creditCost: number
  dependsOn: string[]
}

export interface GroupAiReferenceContext {
  referenceAssetIds: string[]
  sourceRefs: ImageSourceRef[]
  prompt: string
  parameters: Record<string, unknown>
  settings?: ImageDialogueSettings
  workflowId?: string | number | null
  taskTitle: string
  capabilityCode: string
}

const IMAGE_DIALOGUE_CREDIT = Number.parseInt(IMAGE_DIALOGUE_CREDITS, 10) || 22
const VIDEO_DIALOGUE_CREDIT = Number.parseInt(VIDEO_DIALOGUE_CREDITS, 10) || 135

const CAPABILITY_LABEL_ENTRIES: Array<{ label: string; code: string }> = [
  ...IMAGE_NODE_TOOLBAR.actions.map((item) => ({ label: item.label, code: item.key })),
  { label: '去水印', code: 'watermark' },
  { label: 'HD 高清', code: 'hd' },
  { label: '局部修改', code: 'IMAGE_INPAINT' },
  { label: '反推提示词', code: 'IMAGE_PROMPT_REVERSE' },
  { label: '图生3D', code: 'IMAGE_TO_3D' },
]

function isNodeGenerationBusy(data: CanvasNodeData): boolean {
  if (data.imageGenState === 'loading') return true
  if (data.textGenState === 'loading') return true
  if (isVideoNodeGenerating(data)) return true
  if (data.uploadState === 'uploading' && !data.generationTaskId) return true
  return false
}

function isExcludedFromGroupExecute(data: CanvasNodeData): boolean {
  if (data.gridSplitTile) return true
  if (data.compactPreview && data.gridSplitTile) return true
  return false
}

function findIncomingImageNodes(graph: Graph, targetNodeId: string): Node[] {
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

function resolveTitlePrefix(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return ''
  const dash = trimmed.indexOf('-')
  if (dash > 0) return trimmed.slice(0, dash).trim()
  return trimmed
}

export function resolveImageCapabilityFromNode(data: CanvasNodeData): { code: string; label: string } | null {
  const titlePrefix = resolveTitlePrefix(data.title || data.fileName || '')
  if (titlePrefix) {
    const matched = CAPABILITY_LABEL_ENTRIES.find(
      (item) => item.label === titlePrefix || titlePrefix.includes(item.label),
    )
    if (matched) return { code: matched.code, label: matched.label }
  }

  const prompt = data.imageDialogueText?.trim() || data.genPrompt?.trim() || ''
  const hasDialogueConfig = Boolean(
    data.generationParams ||
      data.imageDialogueSettings?.modelKey ||
      data.imageDialogueSettings?.aspectRatio ||
      data.imageDialogueSettings?.workflowId,
  )
  if (prompt || hasDialogueConfig || data.imageSourceRefs?.length) {
    return { code: IMAGE_GENERAL_CAPABILITY_CODE, label: data.title === '文生图' ? '文生图' : '图生图' }
  }

  return null
}

function isImg2PromptTextNode(data: CanvasNodeData): boolean {
  if (data.textPickerTask === 'img2prompt') return true
  const title = data.title?.trim() || ''
  if (title === '反推提示词' || resolveTitlePrefix(title) === '反推提示词') return true
  const capabilityCode = data.generationParams?.capabilityCode?.trim()
  if (capabilityCode === 'IMAGE_PROMPT_REVERSE') return true
  return false
}

function resolveTextTaskKind(data: CanvasNodeData): GroupAiTaskKind | null {
  if (isImg2PromptTextNode(data)) return 'textImg2Prompt'

  const pickerTask = data.textPickerTask
  if (pickerTask === 'text2video') return 'text2video'
  if (pickerTask === 'text2image') return 'text2image'
  if ((pickerTask === 'write' || !pickerTask) && data.genPrompt?.trim()) return 'textCopy'
  return null
}

function resolveIncomingTextPrompt(graph: Graph, nodeId: string): string {
  for (const textNode of findIncomingTextNodes(graph, nodeId)) {
    const data = textNode.getData() as CanvasNodeData
    const text = plainTextFromNodeContent(data.content)
    if (text) return text
  }
  return ''
}

function resolveGroupAiTask(graph: Graph, node: Node, scopeIds: Set<string>): GroupAiTask | null {
  const data = node.getData() as CanvasNodeData
  if (!isAiGeneratedCanvasNode(data)) return null
  if (isExcludedFromGroupExecute(data)) return null
  if (isNodeGenerationBusy(data)) return null

  const dependsOn = collectAiDependencies(graph, node.id, scopeIds)

  if (data.kind === 'image') {
    const capability = resolveImageCapabilityFromNode(data)
    if (!capability) return null
    const kind: GroupAiTaskKind =
      capability.code === IMAGE_GENERAL_CAPABILITY_CODE ? 'imageDialogue' : 'imageCapability'
    const count = Math.max(1, Math.floor(Number(data.imageDialogueSettings?.imageCount)) || 1)
    return {
      nodeId: node.id,
      kind,
      capabilityCode: capability.code,
      creditCost: IMAGE_DIALOGUE_CREDIT * count,
      dependsOn,
    }
  }

  if (data.kind === 'text') {
    const kind = resolveTextTaskKind(data)
    if (!kind) return null
    if (kind === 'textImg2Prompt') {
      const synced = syncTextNodeImageSource(graph, node)
      const assetId = resolveReferenceAssetIdFromNode(graph, synced, scopeIds, new Map())
      if (!assetId) return null
      return {
        nodeId: node.id,
        kind,
        capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
        creditCost: GROUP_EXECUTE_IMG2PROMPT_CREDITS,
        dependsOn,
      }
    }
    if (kind === 'textCopy') {
      return {
        nodeId: node.id,
        kind,
        capabilityCode: 'TEXT_COPY_V1',
        creditCost: GROUP_EXECUTE_TEXT_COPY_CREDITS,
        dependsOn,
      }
    }
    if (kind === 'text2image') {
      if (!data.genPrompt?.trim()) return null
      return {
        nodeId: node.id,
        kind,
        capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
        creditCost: IMAGE_DIALOGUE_CREDIT,
        dependsOn,
      }
    }
    if (kind === 'text2video') {
      if (!data.genPrompt?.trim() && !data.videoDialogueText?.trim()) return null
      const count = Math.max(1, Math.floor(Number(data.videoDialogueSettings?.videoCount)) || 1)
      return {
        nodeId: node.id,
        kind,
        capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
        creditCost: VIDEO_DIALOGUE_CREDIT * count,
        dependsOn,
      }
    }
  }

  if (data.kind === 'video') {
    const prompt = data.videoDialogueText?.trim() || data.genPrompt?.trim() || ''
    if (!prompt) return null
    const count = Math.max(1, Math.floor(Number(data.videoDialogueSettings?.videoCount)) || 1)
    return {
      nodeId: node.id,
      kind: 'videoDialogue',
      capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
      creditCost: VIDEO_DIALOGUE_CREDIT * count,
      dependsOn,
    }
  }

  return null
}

function collectAiDependencies(graph: Graph, nodeId: string, scopeIds: Set<string>): string[] {
  const deps = new Set<string>()
  const cell = graph.getCellById(nodeId)
  const data = cell?.isNode() ? (cell.getData() as CanvasNodeData) : null

  if (data?.sourceNodeId && scopeIds.has(data.sourceNodeId)) {
    const upstream = graph.getCellById(data.sourceNodeId)
    if (upstream?.isNode() && isAiGeneratedCanvasNode(upstream.getData() as CanvasNodeData)) {
      deps.add(data.sourceNodeId)
    }
  }

  for (const edge of graph.getEdges()) {
    if (edge.getTargetCellId() !== nodeId) continue
    const sourceId = edge.getSourceCellId()
    if (!sourceId || !scopeIds.has(sourceId) || sourceId === nodeId) continue
    const source = graph.getCellById(sourceId)
    if (!source?.isNode()) continue
    if (!isAiGeneratedCanvasNode(source.getData() as CanvasNodeData)) continue
    deps.add(sourceId)
  }

  return [...deps]
}

export function collectGroupAiTasks(graph: Graph, groupId: string): GroupAiTask[] {
  const scopeIds = new Set(getGroupBoxNodeIds(graph, groupId))
  const tasks: GroupAiTask[] = []

  scopeIds.forEach((id) => {
    const node = graph.getCellById(id)
    if (!node?.isNode()) return
    const task = resolveGroupAiTask(graph, node as Node, scopeIds)
    if (task) tasks.push(task)
  })

  return tasks
}

export function sortGroupAiTasksByDependency(tasks: GroupAiTask[]): GroupAiTask[] {
  if (tasks.length <= 1) return tasks

  const taskMap = new Map(tasks.map((task) => [task.nodeId, task]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  tasks.forEach((task) => {
    inDegree.set(task.nodeId, 0)
    adjacency.set(task.nodeId, [])
  })

  tasks.forEach((task) => {
    task.dependsOn.forEach((depId) => {
      if (!taskMap.has(depId)) return
      adjacency.get(depId)?.push(task.nodeId)
      inDegree.set(task.nodeId, (inDegree.get(task.nodeId) ?? 0) + 1)
    })
  })

  const queue = tasks
    .filter((task) => (inDegree.get(task.nodeId) ?? 0) === 0)
    .map((task) => task.nodeId)
  const orderedIds: string[] = []

  while (queue.length) {
    const current = queue.shift()!
    orderedIds.push(current)
    for (const next of adjacency.get(current) ?? []) {
      const nextDegree = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, nextDegree)
      if (nextDegree === 0) queue.push(next)
    }
  }

  if (orderedIds.length !== tasks.length) return tasks
  return orderedIds.map((id) => taskMap.get(id)!)
}

/** 按依赖层级分组：同层节点互不依赖，可并行执行 */
export function groupGroupAiTasksByDependencyLevel(tasks: GroupAiTask[]): GroupAiTask[][] {
  if (tasks.length <= 1) return [tasks]

  const taskMap = new Map(tasks.map((task) => [task.nodeId, task]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  tasks.forEach((task) => {
    inDegree.set(task.nodeId, 0)
    adjacency.set(task.nodeId, [])
  })

  tasks.forEach((task) => {
    task.dependsOn.forEach((depId) => {
      if (!taskMap.has(depId)) return
      adjacency.get(depId)?.push(task.nodeId)
      inDegree.set(task.nodeId, (inDegree.get(task.nodeId) ?? 0) + 1)
    })
  })

  const levels: GroupAiTask[][] = []
  let ready = tasks.filter((task) => (inDegree.get(task.nodeId) ?? 0) === 0)

  while (ready.length) {
    levels.push(ready)
    const nextReady: GroupAiTask[] = []
    for (const task of ready) {
      for (const nextId of adjacency.get(task.nodeId) ?? []) {
        const nextDegree = (inDegree.get(nextId) ?? 0) - 1
        inDegree.set(nextId, nextDegree)
        if (nextDegree === 0) {
          const nextTask = taskMap.get(nextId)
          if (nextTask) nextReady.push(nextTask)
        }
      }
    }
    ready = nextReady
  }

  if (levels.flat().length !== tasks.length) return [tasks]
  return levels
}

function resolveReferenceAssetIdFromNode(
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

  const prompt =
    savedParams?.prompt?.trim() ||
    data.imageDialogueText?.trim() ||
    data.genPrompt?.trim() ||
    data.videoDialogueText?.trim() ||
    resolveIncomingTextPrompt(graph, node.id) ||
    ''

  if (task.kind === 'imageCapability' || task.kind === 'imageDialogue') {
    if (task.kind === 'imageCapability') {
      if (!referenceAssetIds.length) return null
      return {
        referenceAssetIds,
        sourceRefs,
        prompt,
        parameters: withPrimaryAssetId(
          { ...(savedParams?.parameters ?? {}) },
          primaryAssetId,
        ),
        taskTitle: resolveTitlePrefix(data.title) || data.title || '生成',
        capabilityCode: savedParams?.capabilityCode || task.capabilityCode,
      }
    }

    // 文生图允许无参考图；图生图优先用已保存参数，但参考图始终取上游最新
    if (!prompt && !savedParams) return null

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
        ...(savedParams?.parameters?.resolution ?? settings?.resolution
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
      capabilityCode: savedParams?.capabilityCode || IMAGE_GENERAL_CAPABILITY_CODE,
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
          aspectRatio: savedParams?.parameters?.aspectRatio ?? data.imageDialogueSettings?.aspectRatio,
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
      capabilityCode: savedParams?.capabilityCode || IMAGE_GENERAL_CAPABILITY_CODE,
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
      capabilityCode: savedParams?.capabilityCode || VIDEO_GENERAL_CAPABILITY_CODE,
    }
  }

  return null
}

export function estimateGroupExecuteCredits(tasks: GroupAiTask[]): number {
  return tasks.reduce((sum, task) => sum + task.creditCost, 0)
}

export function buildGroupExecuteConfirmContent(taskCount: number, credits: number) {
  if (taskCount <= 0) {
    return {
      main: '即将对组内 0 个生成节点依次执行，是否继续？',
      hint: '仅生成节点会被执行，特殊节点需手动执行。',
    }
  }

  return {
    main: `即将对组内 ${taskCount} 个生成节点分批执行，预计消耗 ${credits} 积分，是否继续？`,
    hint: '同一层级的节点将并行执行；有上下游依赖时，会等上游完成后再执行下游。均在组内已有 AI 节点上原地重新生成，不会新建节点。',
  }
}
