import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import type { CanvasSaveVersionType } from '@/services/api'

/** 将任务类型与描述合并为画布保存用的 description 字段 */
export function formatCanvasDescription(taskType: string, description: string) {
  const text = description.trim()
  if (!text) return ''
  const type = taskType.trim()
  return type ? `[${type}] ${text}` : text
}

/** 资源上传类操作的画布描述 */
export function formatUploadCanvasDescription(resourceName: string) {
  const name = resourceName.trim() || '文件'
  return formatCanvasDescription('上传', `上传了${name}资源`)
}

/** 取画布上最后一个有标题的节点（工作流从左到右，优先最右侧） */
export function resolveLastCanvasNode(graph: Graph): Node | null {
  const nodes = graph.getNodes().filter((node) => {
    const data = node.getData() as CanvasNodeData
    return Boolean(data.title?.trim())
  })
  if (!nodes.length) return null

  return nodes.reduce((latest, node) => {
    const latestBox = latest.getBBox()
    const nodeBox = node.getBBox()
    const latestCenterX = latestBox.x + latestBox.width / 2
    const latestCenterY = latestBox.y + latestBox.height / 2
    const nodeCenterX = nodeBox.x + nodeBox.width / 2
    const nodeCenterY = nodeBox.y + nodeBox.height / 2

    if (nodeCenterX > latestCenterX + 1) return node
    if (nodeCenterX < latestCenterX - 1) return latest
    if (nodeCenterY > latestCenterY) return node
    if (nodeCenterY < latestCenterY) return latest

    const latestZ = latest.getZIndex() ?? 0
    const nodeZ = node.getZIndex() ?? 0
    return nodeZ >= latestZ ? node : latest
  })
}

/** 画布保存时 description 取最后一个节点上方的标题文案 */
export function resolveCanvasSaveDescription(graph: Graph | null | undefined): string {
  if (!graph) return ''
  const node = resolveLastCanvasNode(graph)
  if (!node) return ''
  const data = node.getData() as CanvasNodeData
  return data.title?.trim() || ''
}

/** 根据节点数据解析画布保存 type 字段 */
export function resolveCanvasNodeVersionType(
  data: CanvasNodeData,
): CanvasSaveVersionType | undefined {
  switch (data.generationTaskType) {
    case 'IMAGE':
      return 'IMAGE'
    case 'VIDEO':
      return 'VIDEO'
    case 'TEXT':
      return 'TEXT'
    case 'MODEL':
      return 'CUSTOM'
    default:
      break
  }

  switch (data.kind) {
    case 'image':
      return 'IMAGE'
    case 'video':
      return 'VIDEO'
    case 'text':
      return 'TEXT'
    case 'audio':
    case 'model3d':
      return 'CUSTOM'
    default:
      return undefined
  }
}

/** 画布保存时 type 取最后一个节点的类型 */
export function resolveCanvasSaveType(
  graph: Graph | null | undefined,
): CanvasSaveVersionType | undefined {
  if (!graph) return undefined
  const node = resolveLastCanvasNode(graph)
  if (!node) return undefined
  return resolveCanvasNodeVersionType(node.getData() as CanvasNodeData)
}

export function resolveVideoTaskTypeLabel(mode?: string) {
  switch (mode) {
    case 'text-to-video':
      return '文生视频'
    case 'reference':
      return '全能参考'
    case 'image-to-video':
      return '图生视频'
    case 'first-last-frame':
      return '首尾帧'
    case 'image-ref':
    case 'imageRef':
      return '图片参考'
    default:
      return '视频生成'
  }
}
