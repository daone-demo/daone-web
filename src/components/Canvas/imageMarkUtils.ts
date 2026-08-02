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
    if (data.imageMarkAnalyzing) return true
    const marks = [...(data.imageElementMarks ?? []), ...(data.elementMarks ?? [])]
    return marks.some((mark) => mark.pending)
  })
}

/** 替换画布上所有节点中的同一标记 */
export function replaceImageMarkOnGraph(graph: Graph, markId: string, nextMark: ImageMarkItem) {
  graph.getNodes().forEach((cell) => {
    if (!cell.isNode()) return
    const node = cell as Node
    const data = { ...(node.getData() as CanvasNodeData) }
    let changed = false

    const replaceList = (list?: ImageMarkItem[]) => {
      if (!list?.length) return list
      const index = list.findIndex((mark) => mark.id === markId)
      if (index < 0) return list
      changed = true
      const next = [...list]
      next[index] = nextMark
      return next
    }

    data.imageElementMarks = replaceList(data.imageElementMarks)
    data.elementMarks = replaceList(data.elementMarks)
    if (changed) {
      node.setData(data, { overwrite: true })
    }
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

function filterMarkList(list: ImageMarkItem[] | undefined, markId: string) {
  if (!list?.length) return list
  const next = list.filter((mark) => mark.id !== markId)
  return next.length === list.length ? list : next
}

/** 从节点数据中移除指定标记 */
export function removeImageMarkFromNode(node: Node, markId: string) {
  const data = { ...(node.getData() as CanvasNodeData) }
  let changed = false

  if (data.imageElementMarks?.length) {
    const next = filterMarkList(data.imageElementMarks, markId)
    if (next !== data.imageElementMarks) {
      data.imageElementMarks = next
      changed = true
    }
  }
  if (data.elementMarks?.length) {
    const next = filterMarkList(data.elementMarks, markId)
    if (next !== data.elementMarks) {
      data.elementMarks = next
      changed = true
    }
  }

  if (changed) {
    node.setData(data, { overwrite: true })
  }
  return changed
}

/** 从画布所有节点移除指定标记 */
export function removeImageMarkFromGraph(graph: Graph, markId: string) {
  let changed = false
  graph.getNodes().forEach((cell) => {
    if (!cell.isNode()) return
    if (removeImageMarkFromNode(cell as Node, markId)) {
      changed = true
    }
  })
  return changed
}

/** 清空对话目标节点上的元素标记列表 */
export function clearElementMarksOnNode(node: Node) {
  const data = { ...(node.getData() as CanvasNodeData) }
  if (!data.elementMarks?.length) return false
  data.elementMarks = []
  node.setData(data, { overwrite: true })
  return true
}

export function parseMarkIdsFromPrompt(prompt: string): string[] {
  const ids: string[] = []
  const regex = /@标记#([^：\s@]+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(prompt)) !== null) {
    ids.push(match[1])
  }
  return ids
}

/** 从节点标记列表解析生成任务所需的原图像素坐标 */
export function resolveImageMarkTaskCoordinates(
  marks: ImageMarkItem[] | undefined,
  prompt: string,
): { x: number; y: number } | null {
  const completed = (marks ?? []).filter(
    (mark) => !mark.pending && Number.isFinite(mark.x) && Number.isFinite(mark.y),
  )
  if (!completed.length) return null

  const idsFromPrompt = parseMarkIdsFromPrompt(prompt)
  for (const id of idsFromPrompt) {
    const found = completed.find((mark) => mark.id === id)
    if (found) {
      return { x: Math.round(found.x), y: Math.round(found.y) }
    }
  }

  const latest = completed[completed.length - 1]
  return { x: Math.round(latest.x), y: Math.round(latest.y) }
}

/** 将标记坐标写入图片生成任务 parameters（x / y 为原图像素坐标） */
export function applyImageMarkTaskParameters(
  parameters: Record<string, unknown>,
  marks: ImageMarkItem[] | undefined,
  prompt: string,
): void {
  const coords = resolveImageMarkTaskCoordinates(marks, prompt)
  if (!coords) return
  parameters.x = coords.x
  parameters.y = coords.y
}

/** 从提示词文本中移除标记 mention */
export function stripMarkMentionFromPrompt(prompt: string, mark: ImageMarkItem) {
  let next = prompt
  const tokens = [mark.mentionToken, `@标记#${mark.id}`].filter(Boolean)
  for (const token of tokens) {
    next = next.split(token).join('')
  }
  return next.replace(/\s{2,}/g, ' ').trim()
}
