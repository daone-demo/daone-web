import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import { normalizeAssetId } from './constants'
import { applyRemoteImageToNode, applyRemoteVideoToNode } from './upload'
import { connectGenEdge } from './imageGen'
import { addCanvasNode } from './graph'
import type { GroupSkillNode, GroupSkillSubgraph } from './groupSkill'
import { inferWorkflowAiGeneratedNodeIds, parseElementGroupRecord } from './groupSkill'

function resolvePersistedAssetId(item: GroupSkillNode) {
  return normalizeAssetId(item.assetId) || normalizeAssetId(item.sourceAssetId) || ''
}

function createNodeId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function resolveTextPickerTaskFromTitle(title: string): CanvasNodeData['textPickerTask'] | undefined {
  const trimmed = title.trim()
  if (!trimmed) return undefined
  const prefix = trimmed.includes('-') ? trimmed.slice(0, trimmed.indexOf('-')).trim() : trimmed
  if (trimmed === '反推提示词' || prefix === '反推提示词') return 'img2prompt'
  if (trimmed === '文生图' || prefix === '文生图') return 'text2image'
  if (trimmed === '文生视频' || prefix === '文生视频') return 'text2video'
  return undefined
}

function applyAiGeneratedNodeOverrides(item: GroupSkillNode, overrides: Partial<CanvasNodeData>) {
  if (item.kind === 'image') {
    overrides.imageGenState =
      item.imageGenState === 'loading' || item.imageGenState === 'failed'
        ? item.imageGenState
        : 'done'
    if (!overrides.generationTaskType) {
      overrides.generationTaskType = item.generationTaskType || 'IMAGE'
    }
    return
  }
  if (item.kind === 'video') {
    overrides.generationTaskType = item.generationTaskType || 'VIDEO'
    return
  }
  if (item.kind === 'text') {
    overrides.textGenState =
      item.textGenState === 'loading' || item.textGenState === 'failed'
        ? item.textGenState
        : 'done'
    overrides.generationTaskType = item.generationTaskType || 'TEXT'
    const picker =
      item.textPickerTask || resolveTextPickerTaskFromTitle(item.title || '')
    if (picker) {
      overrides.textPickerTask = picker
    }
  }
}

function buildPersistedNodeOverrides(item: GroupSkillNode): Partial<CanvasNodeData> {
  const overrides: Partial<CanvasNodeData> = {
    mode: 'editor',
    title: item.title || item.fileName || '节点',
    content: item.content,
    fileName: item.fileName || '',
    genPrompt: item.genPrompt,
    uploadState: item.previewUrl ? 'done' : 'idle',
    uploadProgress: item.previewUrl ? 100 : 0,
  }

  if (item.textPickerTask) {
    overrides.textPickerTask = item.textPickerTask
  }
  if (item.textGenState) {
    overrides.textGenState = item.textGenState
  }
  if (item.imageGenState) {
    overrides.imageGenState = item.imageGenState
  }
  if (item.generationTaskType) {
    overrides.generationTaskType = item.generationTaskType
  }
  if (item.imageDialogueText) {
    overrides.imageDialogueText = item.imageDialogueText
  }
  if (item.imageDialogueSettings) {
    overrides.imageDialogueSettings = { ...item.imageDialogueSettings }
  }
  if (item.videoDialogueText) {
    overrides.videoDialogueText = item.videoDialogueText
  }
  if (item.videoDialogueSettings) {
    overrides.videoDialogueSettings = { ...item.videoDialogueSettings }
  }
  if (item.generationParams) {
    overrides.generationParams = { ...item.generationParams }
  }

  return overrides
}

export function spawnElementGroupOnCanvas(
  graph: Graph,
  workflow: GroupSkillSubgraph,
  anchor: { x: number; y: number },
): Node[] {
  if (!workflow.nodes.length) return []

  const idMap = new Map<string, string>()
  const centerX = workflow.nodes.reduce((sum, node) => sum + node.position.x, 0) / workflow.nodes.length
  const centerY = workflow.nodes.reduce((sum, node) => sum + node.position.y, 0) / workflow.nodes.length
  const offsetX = anchor.x - centerX
  const offsetY = anchor.y - centerY

  const createdNodes: Node[] = []
  const aiGeneratedIds = inferWorkflowAiGeneratedNodeIds(workflow)

  for (const item of workflow.nodes) {
    const newId = createNodeId()
    idMap.set(item.id, newId)

    const persistedAssetId = resolvePersistedAssetId(item)
    const overrides = buildPersistedNodeOverrides(item)
    if (persistedAssetId) {
      overrides.assetId = persistedAssetId
      const sourceAssetId = normalizeAssetId(item.sourceAssetId)
      if (sourceAssetId) {
        overrides.sourceAssetId = sourceAssetId
      }
    }
    if (aiGeneratedIds.has(item.id)) {
      applyAiGeneratedNodeOverrides(item, overrides)
    }

    const point = {
      x: item.position.x + offsetX,
      y: item.position.y + offsetY,
    }

    const node = addCanvasNode(graph, item.kind, point, overrides, { id: newId })

    if (item.previewUrl && item.kind === 'image') {
      const preservedTitle = item.title || item.fileName || ''
      void applyRemoteImageToNode(node, {
        assetId: persistedAssetId || undefined,
        previewUrl: item.previewUrl,
        fileName: item.fileName || item.title,
      }).then(() => {
        // 工作流节点标题常含能力名前缀（如「局部修改」），不能被 fileName 覆盖
        if (!preservedTitle) return
        const current = { ...(node.getData() as CanvasNodeData) }
        if (current.title === preservedTitle) return
        current.title = preservedTitle
        node.setData(current)
      })
    } else if (item.previewUrl && item.kind === 'video') {
      void applyRemoteVideoToNode(node, {
        assetId: persistedAssetId || undefined,
        previewUrl: item.previewUrl,
        fileName: item.fileName,
      })
    } else if (persistedAssetId) {
      const data = { ...(node.getData() as CanvasNodeData) }
      data.assetId = persistedAssetId
      const sourceAssetId = normalizeAssetId(item.sourceAssetId)
      if (sourceAssetId) {
        data.sourceAssetId = sourceAssetId
      }
      node.setData(data)
    }

    createdNodes.push(node)
  }

  for (const edge of workflow.edges) {
    const source = idMap.get(edge.source)
    const target = idMap.get(edge.target)
    if (source && target) {
      connectGenEdge(graph, source, target)
    }
  }

  return createdNodes
}

export function addElementGroupRecordToCanvas(
  graph: Graph,
  record: Record<string, unknown>,
  anchor?: { x: number; y: number },
): Node[] {
  const workflow = parseElementGroupRecord(record)
  if (!workflow) return []

  const point = anchor ?? { x: 0, y: 0 }
  return spawnElementGroupOnCanvas(graph, workflow, point)
}
