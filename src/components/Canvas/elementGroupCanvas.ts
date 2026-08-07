import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import { applyRemoteImageToNode, applyRemoteVideoToNode } from './upload'
import { connectGenEdge } from './imageGen'
import { addCanvasNode } from './graph'
import type { GroupSkillNode, GroupSkillSubgraph } from './groupSkill'
import { parseElementGroupRecord } from './groupSkill'

function resolvePersistedAssetId(item: GroupSkillNode) {
  return item.assetId?.trim() || item.sourceAssetId?.trim() || ''
}

function createNodeId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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

  for (const item of workflow.nodes) {
    const newId = createNodeId()
    idMap.set(item.id, newId)

    const persistedAssetId = resolvePersistedAssetId(item)
    const overrides: Partial<CanvasNodeData> = {
      mode: 'editor',
      title: item.title || item.fileName || '节点',
      content: item.content,
      fileName: item.fileName || '',
      genPrompt: item.genPrompt,
      uploadState: item.previewUrl ? 'done' : 'idle',
      uploadProgress: item.previewUrl ? 100 : 0,
    }
    if (persistedAssetId) {
      overrides.assetId = persistedAssetId
      if (item.sourceAssetId?.trim()) {
        overrides.sourceAssetId = item.sourceAssetId.trim()
      }
    }

    const point = {
      x: item.position.x + offsetX,
      y: item.position.y + offsetY,
    }

    const node = addCanvasNode(graph, item.kind, point, overrides, { id: newId })

    if (item.previewUrl && item.kind === 'image') {
      void applyRemoteImageToNode(node, {
        assetId: persistedAssetId || undefined,
        previewUrl: item.previewUrl,
        fileName: item.fileName,
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
      if (item.sourceAssetId?.trim()) {
        data.sourceAssetId = item.sourceAssetId.trim()
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
