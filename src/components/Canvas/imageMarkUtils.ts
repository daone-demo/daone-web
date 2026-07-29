import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData, ImageMarkBBox, ImageMarkItem } from './constants'
import { buildImageMarkMentionToken } from './promptMention'
import { clientPointToGraphLocal, getImageNodeMediaGraphBBox } from './graph'
import type { GenerationTaskDetail } from './generationTask'

export function createImageMarkId() {
  return `mark-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 将画布点击坐标转换为原图像素坐标 */
export function clientPointToImageNaturalCoords(
  graph: Graph,
  node: Node,
  clientX: number,
  clientY: number,
) {
  const data = node.getData() as CanvasNodeData
  const mediaWidth = data.mediaWidth
  const mediaHeight = data.mediaHeight
  if (!mediaWidth || !mediaHeight) return null

  const mediaBox = getImageNodeMediaGraphBBox(node)
  const point = clientPointToGraphLocal(graph, clientX, clientY)
  const relX = point.x - mediaBox.x
  const relY = point.y - mediaBox.y

  if (relX < 0 || relY < 0 || relX > mediaBox.width || relY > mediaBox.height) {
    return null
  }

  const x = Math.round((relX / mediaBox.width) * mediaWidth)
  const y = Math.round((relY / mediaBox.height) * mediaHeight)

  return {
    x: Math.max(0, Math.min(mediaWidth, x)),
    y: Math.max(0, Math.min(mediaHeight, y)),
    imageWidth: mediaWidth,
    imageHeight: mediaHeight,
  }
}

function normalizeBBox(raw: unknown, imageWidth: number, imageHeight: number): ImageMarkBBox | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const box = raw as Record<string, unknown>
  const x = Number(box.x)
  const y = Number(box.y)
  const width = Number(box.width ?? box.w)
  const height = Number(box.height ?? box.h)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return undefined
  }
  if (width <= 0 || height <= 0) return undefined
  return {
    x: Math.max(0, Math.min(imageWidth, Math.round(x))),
    y: Math.max(0, Math.min(imageHeight, Math.round(y))),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  }
}

function parseMarkContent(content: string, imageWidth: number, imageHeight: number) {
  const trimmed = content.trim()
  if (!trimmed) return null

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    const label = String(parsed.label ?? parsed.name ?? parsed.text ?? '').trim()
    if (!label) return null
    const description = String(parsed.description ?? parsed.desc ?? '').trim() || undefined
    const bbox = normalizeBBox(parsed.bbox ?? parsed.box ?? parsed.rect, imageWidth, imageHeight)
    return { label, description, bbox }
  } catch {
    return { label: trimmed, description: undefined, bbox: undefined }
  }
}

/** 从 IMAGE_MARK_RECOGNIZE 任务结果解析标记信息 */
export function parseImageMarkRecognizeResult(
  task: GenerationTaskDetail,
  fallback: { x: number; y: number; imageWidth: number; imageHeight: number },
): {
  label: string
  labelOptions: string[]
  description?: string
  bbox?: ImageMarkBBox
} | null {
  const labels: string[] = []
  let description: string | undefined
  let bbox: ImageMarkBBox | undefined

  for (const item of task.results ?? []) {
    const content = String(item.content || '').trim()
    if (!content) {
      const directLabel = String((item as Record<string, unknown>).label ?? '').trim()
      if (directLabel) labels.push(directLabel)
      continue
    }

    const parsed = parseMarkContent(content, fallback.imageWidth, fallback.imageHeight)
    if (parsed?.label) {
      labels.push(parsed.label)
      if (!description && parsed.description) description = parsed.description
      if (!bbox && parsed.bbox) bbox = parsed.bbox
      continue
    }

    labels.push(content)
  }

  const labelOptions = [...new Set(labels.filter(Boolean))]
  if (!labelOptions.length) return null

  return {
    label: labelOptions[0],
    labelOptions,
    description,
    bbox,
  }
}

export function buildImageMarkItem(options: {
  sourceNodeId: string
  assetId: string
  x: number
  y: number
  imageWidth: number
  imageHeight: number
  label: string
  labelOptions?: string[]
  selectedLabelIndex?: number
  description?: string
  bbox?: ImageMarkBBox
}): ImageMarkItem {
  const id = createImageMarkId()
  const labelOptions = options.labelOptions?.length
    ? [...new Set(options.labelOptions.filter(Boolean))]
    : [options.label]
  const selectedLabelIndex = Math.min(
    Math.max(0, options.selectedLabelIndex ?? 0),
    labelOptions.length - 1,
  )
  const label = labelOptions[selectedLabelIndex] ?? options.label

  return {
    id,
    label,
    labelOptions,
    selectedLabelIndex,
    description: options.description,
    x: options.x,
    y: options.y,
    bbox: options.bbox,
    sourceNodeId: options.sourceNodeId,
    assetId: options.assetId,
    imageWidth: options.imageWidth,
    imageHeight: options.imageHeight,
    mentionToken: buildImageMarkMentionToken({ id }),
  }
}

export function patchImageMarkLabel(mark: ImageMarkItem, selectedLabelIndex: number): ImageMarkItem {
  const labelOptions = mark.labelOptions?.length ? mark.labelOptions : [mark.label]
  const index = Math.min(Math.max(0, selectedLabelIndex), labelOptions.length - 1)
  const label = labelOptions[index] ?? mark.label
  return {
    ...mark,
    label,
    labelOptions,
    selectedLabelIndex: index,
    mentionToken: buildImageMarkMentionToken({ id: mark.id }),
  }
}

export function updateImageMarkLabelOnNode(node: Node, markId: string, selectedLabelIndex: number) {
  const data = { ...(node.getData() as CanvasNodeData) }
  let changed = false

  const patchList = (list?: ImageMarkItem[]) => {
    if (!list?.length) return list
    const next = list.map((mark) => {
      if (mark.id !== markId) return mark
      changed = true
      return patchImageMarkLabel(mark, selectedLabelIndex)
    })
    return next
  }

  if (data.elementMarks) data.elementMarks = patchList(data.elementMarks)
  if (data.imageElementMarks) data.imageElementMarks = patchList(data.imageElementMarks)

  if (changed) {
    node.setData(data, { overwrite: true })
  }

  return changed
}

export function appendImageMarkToNode(node: Node, mark: ImageMarkItem) {
  const data = { ...(node.getData() as CanvasNodeData) }
  const current = Array.isArray(data.imageElementMarks) ? data.imageElementMarks : []
  data.imageElementMarks = [...current, mark]
  node.setData(data, { overwrite: true })
}

export function appendElementMarkToNode(node: Node, mark: ImageMarkItem) {
  const data = { ...(node.getData() as CanvasNodeData) }
  const current = Array.isArray(data.elementMarks) ? data.elementMarks : []
  data.elementMarks = [...current, mark]
  node.setData(data, { overwrite: true })
}

export function setImageMarkAnalyzing(node: Node, point: { x: number; y: number } | null) {
  const data = { ...(node.getData() as CanvasNodeData) }
  data.imageMarkAnalyzing = point
  node.setData(data, { overwrite: true })
}

export function isImageMarkAnalyzing(graph: Graph): boolean {
  return graph.getNodes().some((cell) => {
    const data = (cell as Node).getData() as CanvasNodeData
    return Boolean(data.imageMarkAnalyzing)
  })
}

export function markStyleFromNatural(
  value: number,
  total: number,
  axis: 'x' | 'y' | 'size',
) {
  if (!total) return '0%'
  const ratio = value / total
  if (axis === 'size') return `${ratio * 100}%`
  return `${ratio * 100}%`
}
