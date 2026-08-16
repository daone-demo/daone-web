import type { Graph, Node } from '@antv/x6'
import {
  GROUP_EXECUTE_IMG2PROMPT_CREDITS,
  GROUP_EXECUTE_TEXT_COPY_CREDITS,
  IMAGE_DIALOGUE_CREDITS,
  IMAGE_GENERAL_CAPABILITY_CODE,
  VIDEO_DIALOGUE_CREDITS,
  VIDEO_GENERAL_CAPABILITY_CODE,
  hasPersistedImageDialogueProvenance,
  isAiGeneratedCanvasNode,
  isCanvasGenerationFailed,
  isVideoNodeGenerating,
  resolveImageAssetId,
  type CanvasNodeData,
} from '../constants'
import { isCropDerivedImageData } from '../imageGen'
import { isGridSplitDerivedImageData } from '../gridSplitUtils'
import { getGroupBoxNodeIds, isGroupSourceImageNode } from '../nodeGroup'
import { syncTextNodeImageSource } from '../textPrompt'
import { plainTextFromNodeContent } from '../videoGen'
import {
  resolveAdvisorPromptFromTitle,
  resolveImageCapabilityFromNode,
  resolveTitlePrefix,
} from './capabilityLabels'
import {
  findIncomingImageNodes,
  isImg2PromptTextNode,
  resolveIncomingTextPrompt,
  resolveReferenceAssetIdFromNode,
} from './referenceContext'
import type { GroupAiTask, GroupAiTaskKind } from './types'

const IMAGE_DIALOGUE_CREDIT = Number.parseInt(IMAGE_DIALOGUE_CREDITS, 10) || 22
const VIDEO_DIALOGUE_CREDIT = Number.parseInt(VIDEO_DIALOGUE_CREDITS, 10) || 135

function hasGroupInternalIncomingEdge(
  graph: Graph,
  nodeId: string,
  scopeIds: Set<string>,
): boolean {
  for (const edge of graph.getEdges()) {
    if (edge.getTargetCellId() !== nodeId) continue
    const sourceId = edge.getSourceCellId()
    if (sourceId && scopeIds.has(sourceId) && sourceId !== nodeId) return true
  }
  return false
}

function hasImageGenerationProvenance(data: CanvasNodeData): boolean {
  if (data.generationParams?.taskType === 'IMAGE') return true
  if (String(data.generationParams?.capabilityCode ?? '').trim()) return true
  if (hasPersistedImageDialogueProvenance(data)) return true
  if (data.imageSourceRefs?.length) return true
  if (data.elementMarks?.length) return true
  if (data.genPrompt?.trim() || data.imageDialogueText?.trim()) return true
  if (resolveImageCapabilityFromNode(data)) return true
  if (resolveAdvisorPromptFromTitle(data.title || data.fileName || '')) return true
  return false
}

/** 整组执行可识别的 AI 生成节点（含工作流多结果等未写入 imageGenState 的对话框产物） */
function isGroupAiGenerationTarget(
  graph: Graph,
  node: Node,
  scopeIds: Set<string>,
  data: CanvasNodeData,
): boolean {
  if (isAiGeneratedCanvasNode(data)) return true
  if (isExcludedFromGroupExecute(data)) return false

  // 工作流导入后文本节点可能丢失 textGenState，仍需按标题/连线识别
  if (data.kind === 'text') {
    if (!hasGroupInternalIncomingEdge(graph, node.id, scopeIds)) return false
    return Boolean(resolveTextTaskKind(graph, node, data))
  }

  if (data.kind !== 'image') return false
  if (isGridSplitDerivedImageData(data)) return false
  if (isCropDerivedImageData(data)) return false
  if (isGroupSourceImageNode(graph, node)) return false
  if (!hasGroupInternalIncomingEdge(graph, node.id, scopeIds)) return false
  // 生成失败节点（仅标题标记）在导入后仍应可重跑
  if (isCanvasGenerationFailed(data)) return true
  if (!data.previewUrl?.trim() && data.imageGenState !== 'loading') return false
  return hasImageGenerationProvenance(data)
}

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

function resolveTextTaskKind(
  graph: Graph,
  node: Node,
  data: CanvasNodeData,
): GroupAiTaskKind | null {
  if (isImg2PromptTextNode(data)) return 'textImg2Prompt'

  const pickerTask = data.textPickerTask
  if (pickerTask === 'text2video') return 'text2video'
  if (pickerTask === 'text2image') return 'text2image'
  if ((pickerTask === 'write' || !pickerTask) && data.genPrompt?.trim()) return 'textCopy'

  // 工作流导入的反推文本：有上游图片连线且已有文案内容时，按反推任务识别
  if (plainTextFromNodeContent(data.content) && findIncomingImageNodes(graph, node.id).length) {
    return 'textImg2Prompt'
  }

  return null
}

/** 反推提示词优先取「入边」图片素材，避免误用下游文生图结果节点的 assetId */
function resolveImg2PromptReferenceAssetId(
  graph: Graph,
  data: CanvasNodeData,
  scopeIds: Set<string>,
  finishedAssets: Map<string, string>,
  nodeId: string,
): string {
  const incoming = findIncomingImageNodes(graph, nodeId)
  const ordered = [
    ...incoming.filter((imageNode) => scopeIds.has(imageNode.id)),
    ...incoming.filter((imageNode) => !scopeIds.has(imageNode.id)),
  ]
  for (const imageNode of ordered) {
    const finished = finishedAssets.get(imageNode.id)
    if (finished) return finished
    const assetId = resolveImageAssetId(imageNode.getData() as CanvasNodeData)
    if (assetId) return assetId
  }
  return resolveReferenceAssetIdFromNode(graph, data, scopeIds, finishedAssets)
}

function resolveGroupAiTask(graph: Graph, node: Node, scopeIds: Set<string>): GroupAiTask | null {
  const data = node.getData() as CanvasNodeData
  if (!isGroupAiGenerationTarget(graph, node, scopeIds, data)) return null
  if (isExcludedFromGroupExecute(data)) return null
  if (isNodeGenerationBusy(data)) return null

  const dependsOn = collectAiDependencies(graph, node.id, scopeIds)

  if (data.kind === 'image') {
    const capability =
      resolveImageCapabilityFromNode(data) ??
      // 工作流导入后可能丢失 prompt/参数，但已是 AI 结果/失败节点：仍纳入整组执行
      (isAiGeneratedCanvasNode(data) ||
      isCanvasGenerationFailed(data) ||
      hasImageGenerationProvenance(data)
        ? {
            code: IMAGE_GENERAL_CAPABILITY_CODE,
            label: resolveTitlePrefix(data.title) || data.title || '图生图',
          }
        : null)
    if (!capability) return null

    const incomingTextPrompt = resolveIncomingTextPrompt(graph, node.id)
    const hasPromptOrParams = Boolean(
      data.imageDialogueText?.trim() ||
      data.genPrompt?.trim() ||
      data.generationParams?.prompt?.trim() ||
      data.generationParams ||
      data.imageDialogueSettings?.modelKey ||
      resolveAdvisorPromptFromTitle(data.title || data.fileName || '') ||
      incomingTextPrompt,
    )
    // 上游是文本（反推→文生图）或已有 prompt 时走 imageDialogue；否则走能力重跑
    const kind: GroupAiTaskKind =
      capability.code === IMAGE_GENERAL_CAPABILITY_CODE && hasPromptOrParams
        ? 'imageDialogue'
        : 'imageCapability'
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
    const kind = resolveTextTaskKind(graph, node, data)
    if (!kind) return null
    if (kind === 'textImg2Prompt') {
      const synced = syncTextNodeImageSource(graph, node)
      const assetId = resolveImg2PromptReferenceAssetId(graph, synced, scopeIds, new Map(), node.id)
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
      if (!data.genPrompt?.trim() && !plainTextFromNodeContent(data.content)) return null
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
    if (
      upstream?.isNode() &&
      isGroupAiGenerationTarget(
        graph,
        upstream as Node,
        scopeIds,
        upstream.getData() as CanvasNodeData,
      )
    ) {
      deps.add(data.sourceNodeId)
    }
  }

  for (const edge of graph.getEdges()) {
    if (edge.getTargetCellId() !== nodeId) continue
    const sourceId = edge.getSourceCellId()
    if (!sourceId || !scopeIds.has(sourceId) || sourceId === nodeId) continue
    const source = graph.getCellById(sourceId)
    if (!source?.isNode()) continue
    if (
      !isGroupAiGenerationTarget(
        graph,
        source as Node,
        scopeIds,
        source.getData() as CanvasNodeData,
      )
    ) {
      continue
    }
    deps.add(sourceId)
  }

  return [...deps]
}

/** 仅保留本轮任务集合内的依赖边（源图等非任务节点不阻塞下游） */
function rewireTaskDependencies(
  graph: Graph,
  tasks: GroupAiTask[],
  scopeIds: Set<string>,
): GroupAiTask[] {
  const taskIds = new Set(tasks.map((task) => task.nodeId))
  return tasks.map((task) => {
    const deps = new Set<string>()
    const cell = graph.getCellById(task.nodeId)
    const data = cell?.isNode() ? (cell.getData() as CanvasNodeData) : null

    if (data?.sourceNodeId && taskIds.has(data.sourceNodeId)) {
      deps.add(data.sourceNodeId)
    }

    for (const edge of graph.getEdges()) {
      if (edge.getTargetCellId() !== task.nodeId) continue
      const sourceId = edge.getSourceCellId()
      if (!sourceId || !taskIds.has(sourceId) || sourceId === task.nodeId) continue
      if (!scopeIds.has(sourceId)) continue
      deps.add(sourceId)
    }

    // 兜底：沿用 resolve 时已收集的 dependsOn，再与任务集合求交
    for (const depId of task.dependsOn) {
      if (taskIds.has(depId)) deps.add(depId)
    }

    return { ...task, dependsOn: [...deps] }
  })
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

  return rewireTaskDependencies(graph, tasks, scopeIds)
}

function readNodeGenerationResultIndex(graph: Graph, nodeId: string): number {
  const cell = graph.getCellById(nodeId)
  if (!cell?.isNode()) return 0
  const raw = (cell.getData() as CanvasNodeData).generationResultIndex
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw)
  }
  return 0
}

function isShareableImageGroupTask(task: GroupAiTask): boolean {
  return (
    task.kind === 'imageCapability' || task.kind === 'imageDialogue' || task.kind === 'text2image'
  )
}

/**
 * 将共享同一 generationTaskId 的图片任务合并：只保留一个 leader 执行，
 * 其余节点挂到 sharedResultNodeIds，整组执行时只创建一次任务并按结果下标回写。
 */
export function coalesceSharedGenerationTasks(graph: Graph, tasks: GroupAiTask[]): GroupAiTask[] {
  if (tasks.length <= 1) return tasks

  const clusters = new Map<string, string[]>()
  for (const task of tasks) {
    if (!isShareableImageGroupTask(task)) continue
    const cell = graph.getCellById(task.nodeId)
    if (!cell?.isNode()) continue
    const taskId = String((cell.getData() as CanvasNodeData).generationTaskId ?? '').trim()
    if (!taskId) continue
    const list = clusters.get(taskId) ?? []
    list.push(task.nodeId)
    clusters.set(taskId, list)
  }

  const followerIds = new Set<string>()
  const leaderFollowers = new Map<string, string[]>()
  const followerToLeader = new Map<string, string>()

  for (const nodeIds of clusters.values()) {
    if (nodeIds.length < 2) continue
    const sorted = [...nodeIds].sort((a, b) => {
      const indexDiff =
        readNodeGenerationResultIndex(graph, a) - readNodeGenerationResultIndex(graph, b)
      if (indexDiff !== 0) return indexDiff
      return a.localeCompare(b)
    })
    const leaderId = sorted[0]
    const followers = sorted.slice(1)
    leaderFollowers.set(leaderId, followers)
    for (const followerId of followers) {
      followerIds.add(followerId)
      followerToLeader.set(followerId, leaderId)
    }
  }

  if (!followerIds.size) return tasks

  const taskById = new Map(tasks.map((task) => [task.nodeId, task]))
  const leaders = tasks.filter((task) => !followerIds.has(task.nodeId))

  return leaders.map((task) => {
    const followers = leaderFollowers.get(task.nodeId) ?? []
    const dependsOn = new Set<string>()

    const remapDep = (depId: string) => {
      if (depId === task.nodeId) return
      if (followers.includes(depId)) return
      const remapped = followerToLeader.get(depId) ?? depId
      if (remapped === task.nodeId || followers.includes(remapped)) return
      if (followerIds.has(remapped)) return
      dependsOn.add(remapped)
    }

    task.dependsOn.forEach(remapDep)
    for (const followerId of followers) {
      taskById.get(followerId)?.dependsOn.forEach(remapDep)
    }

    return {
      ...task,
      dependsOn: [...dependsOn],
      sharedResultNodeIds: followers.length ? followers : undefined,
    }
  })
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
