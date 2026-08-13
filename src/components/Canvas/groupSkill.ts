import type { Graph, Node } from '@antv/x6'
import type {
  CanvasGenerationParams,
  CanvasNodeData,
  ImageDialogueSettings,
  NodeKind,
  VideoDialogueSettings,
} from './constants'
import { isAiGeneratedCanvasNode, normalizeAssetId } from './constants'

export interface GroupSkillNode {
  id: string
  kind: NodeKind
  title: string
  content: string
  genPrompt?: string
  previewUrl?: string
  fileName?: string
  /** 节点素材 ID，打组保存后拖回画布做标记/生成时必需 */
  assetId?: string
  /** 兼容旧字段：部分图片节点资产落在 sourceAssetId */
  sourceAssetId?: string
  /** 是否为 AI 生成结果，落画布后不可重新上传原图 */
  aiGenerated?: boolean
  /** 文本任务类型，整组执行识别反推/文生图等必需 */
  textPickerTask?: CanvasNodeData['textPickerTask']
  textGenState?: CanvasNodeData['textGenState']
  imageGenState?: CanvasNodeData['imageGenState']
  generationTaskType?: CanvasNodeData['generationTaskType']
  /** 最新生成任务 ID，整组执行时用于合并同任务多结果节点 */
  generationTaskId?: string
  /** 同任务多结果下标 */
  generationResultIndex?: number
  imageDialogueText?: string
  imageDialogueSettings?: Partial<ImageDialogueSettings>
  videoDialogueText?: string
  videoDialogueSettings?: Partial<VideoDialogueSettings>
  /** AI 生成参数快照，导入后整组执行需据此识别能力与 prompt */
  generationParams?: CanvasGenerationParams
  position: { x: number; y: number }
}

export interface GroupSkillSubgraph {
  nodes: GroupSkillNode[]
  edges: Array<{
    id: string
    source: string
    target: string
  }>
}

const KIND_LABELS: Record<NodeKind, string> = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
  model3d: '3D',
}

function pickGenerationParams(
  value: CanvasNodeData['generationParams'],
): CanvasGenerationParams | undefined {
  if (!value || typeof value !== 'object') return undefined
  const capabilityCode = String(value.capabilityCode ?? '').trim()
  const taskType = value.taskType
  if (!capabilityCode && !taskType && !String(value.prompt ?? '').trim()) return undefined
  return {
    taskType: taskType === 'TEXT' || taskType === 'MODEL' || taskType === 'VIDEO' ? taskType : 'IMAGE',
    capabilityCode,
    prompt: String(value.prompt ?? ''),
    parameters: value.parameters && typeof value.parameters === 'object' ? { ...value.parameters } : {},
    workflowId: value.workflowId,
    referenceAssetIds: Array.isArray(value.referenceAssetIds)
      ? value.referenceAssetIds.filter((id): id is string => Boolean(id))
      : undefined,
  }
}

export function extractGroupSubgraph(graph: Graph, nodeIds: string[]): GroupSkillSubgraph | null {
  const idSet = new Set(nodeIds)
  const nodes = nodeIds
    .map((id) => graph.getCellById(id))
    .filter((cell): cell is Node => cell != null && cell.isNode())
    .map((node) => {
      const data = node.getData() as CanvasNodeData
      const pos = node.getPosition()
      const assetId = normalizeAssetId(data.assetId)
      const sourceAssetId = normalizeAssetId(data.sourceAssetId)
      const generationParams = pickGenerationParams(data.generationParams)
      return {
        id: node.id,
        kind: data.kind,
        title: data.title || '',
        content: data.content || '',
        genPrompt: data.genPrompt,
        previewUrl: data.previewUrl,
        fileName: data.fileName,
        assetId,
        sourceAssetId,
        aiGenerated: isAiGeneratedCanvasNode(data) || undefined,
        textPickerTask: data.textPickerTask || undefined,
        textGenState: data.textGenState || undefined,
        imageGenState: data.imageGenState || undefined,
        generationTaskType: data.generationTaskType || undefined,
        generationTaskId: String(data.generationTaskId ?? '').trim() || undefined,
        generationResultIndex:
          typeof data.generationResultIndex === 'number' && Number.isFinite(data.generationResultIndex)
            ? Math.max(0, Math.round(data.generationResultIndex))
            : undefined,
        imageDialogueText: data.imageDialogueText || undefined,
        imageDialogueSettings: data.imageDialogueSettings
          ? { ...data.imageDialogueSettings }
          : undefined,
        videoDialogueText: data.videoDialogueText || undefined,
        videoDialogueSettings: data.videoDialogueSettings
          ? { ...data.videoDialogueSettings }
          : undefined,
        generationParams,
        position: { x: pos.x, y: pos.y },
      }
    })

  if (!nodes.length) return null

  const edges = graph
    .getEdges()
    .filter((edge) => {
      const source = edge.getSourceCellId()
      const target = edge.getTargetCellId()
      return source && target && idSet.has(source) && idSet.has(target)
    })
    .map((edge) => ({
      id: edge.id,
      source: edge.getSourceCellId()!,
      target: edge.getTargetCellId()!,
    }))

  return { nodes, edges }
}

/** 将打组子图转为元素组接口所需的 projectStructure */
export function buildElementGroupStructure(workflow: GroupSkillSubgraph) {
  return {
    cells: [
      ...workflow.nodes.map((node) => ({ type: 'node', ...node })),
      ...workflow.edges.map((edge) => ({ type: 'edge', ...edge })),
    ],
  }
}

function parseNodeKind(value: unknown): NodeKind {
  if (
    value === 'text' ||
    value === 'image' ||
    value === 'video' ||
    value === 'audio' ||
    value === 'model3d'
  ) {
    return value
  }
  return 'text'
}

function parseTextPickerTask(
  value: unknown,
): CanvasNodeData['textPickerTask'] | undefined {
  if (
    value === 'img2prompt' ||
    value === 'text2video' ||
    value === 'text2image' ||
    value === 'write' ||
    value === ''
  ) {
    return value
  }
  return undefined
}

function parseTextGenState(value: unknown): CanvasNodeData['textGenState'] | undefined {
  if (value === 'idle' || value === 'loading' || value === 'done' || value === 'failed') {
    return value
  }
  return undefined
}

function parseImageGenState(value: unknown): CanvasNodeData['imageGenState'] | undefined {
  if (value === 'idle' || value === 'loading' || value === 'done' || value === 'failed') {
    return value
  }
  return undefined
}

function parseGenerationTaskType(
  value: unknown,
): CanvasNodeData['generationTaskType'] | undefined {
  if (value === 'IMAGE' || value === 'TEXT' || value === 'MODEL' || value === 'VIDEO') {
    return value
  }
  return undefined
}

function parsePersistedGenerationParams(value: unknown): CanvasGenerationParams | undefined {
  if (!value || typeof value !== 'object') return undefined
  return pickGenerationParams(value as CanvasGenerationParams)
}

/** 从元素组 cells 解析为可落画布子图 */
export function parseElementGroupCells(cells: unknown[]): GroupSkillSubgraph | null {
  if (!Array.isArray(cells) || !cells.length) return null

  const nodes: GroupSkillNode[] = []
  const edges: GroupSkillSubgraph['edges'] = []

  for (const cell of cells) {
    if (!cell || typeof cell !== 'object') continue
    const item = cell as Record<string, unknown>

    if (item.type === 'edge') {
      const source = String(item.source ?? '')
      const target = String(item.target ?? '')
      const id = String(item.id ?? `${source}-${target}`)
      if (source && target) edges.push({ id, source, target })
      continue
    }

    if (item.type === 'node' || item.kind) {
      const position = item.position as { x?: number; y?: number } | undefined
      const title = String(item.title ?? '')
      nodes.push({
        id: String(item.id ?? `node-${nodes.length}`),
        kind: parseNodeKind(item.kind),
        title,
        content: String(item.content ?? ''),
        genPrompt: typeof item.genPrompt === 'string' ? item.genPrompt : undefined,
        previewUrl: typeof item.previewUrl === 'string' ? item.previewUrl : undefined,
        fileName: typeof item.fileName === 'string' ? item.fileName : undefined,
        assetId: normalizeAssetId(item.assetId ?? item.asset_id),
        sourceAssetId: normalizeAssetId(item.sourceAssetId ?? item.source_asset_id),
        aiGenerated: item.aiGenerated === true ? true : undefined,
        textPickerTask: parseTextPickerTask(item.textPickerTask),
        textGenState: parseTextGenState(item.textGenState),
        imageGenState: parseImageGenState(item.imageGenState),
        generationTaskType: parseGenerationTaskType(item.generationTaskType),
        generationTaskId:
          typeof item.generationTaskId === 'string' && item.generationTaskId.trim()
            ? item.generationTaskId.trim()
            : undefined,
        generationResultIndex:
          typeof item.generationResultIndex === 'number' && Number.isFinite(item.generationResultIndex)
            ? Math.max(0, Math.round(item.generationResultIndex))
            : undefined,
        imageDialogueText:
          typeof item.imageDialogueText === 'string' ? item.imageDialogueText : undefined,
        imageDialogueSettings:
          item.imageDialogueSettings && typeof item.imageDialogueSettings === 'object'
            ? (item.imageDialogueSettings as Partial<ImageDialogueSettings>)
            : undefined,
        videoDialogueText:
          typeof item.videoDialogueText === 'string' ? item.videoDialogueText : undefined,
        videoDialogueSettings:
          item.videoDialogueSettings && typeof item.videoDialogueSettings === 'object'
            ? (item.videoDialogueSettings as Partial<VideoDialogueSettings>)
            : undefined,
        generationParams: parsePersistedGenerationParams(item.generationParams),
        position: {
          x: Number(position?.x ?? 0),
          y: Number(position?.y ?? 0),
        },
      })
    }
  }

  return nodes.length ? { nodes, edges } : null
}

function isWorkflowAiTextTaskNode(node: GroupSkillNode): boolean {
  if (node.kind !== 'text') return false
  if (node.aiGenerated || node.textGenState === 'done' || node.textGenState === 'loading') {
    return true
  }
  if (node.generationTaskType === 'TEXT') return true
  if (node.textPickerTask === 'img2prompt' || node.textPickerTask === 'text2image' || node.textPickerTask === 'text2video') {
    return true
  }
  const title = node.title.trim()
  const prefix = title.includes('-') ? title.slice(0, title.indexOf('-')).trim() : title
  return title === '反推提示词' || prefix === '反推提示词'
}

/** 推断工作流中 AI 生成节点（显式标记或组内有上游连线的图/视频/文本任务节点） */
export function inferWorkflowAiGeneratedNodeIds(workflow: GroupSkillSubgraph): Set<string> {
  const internalTargets = new Set(workflow.edges.map((edge) => edge.target))
  const result = new Set<string>()

  for (const node of workflow.nodes) {
    if (node.aiGenerated) {
      result.add(node.id)
      continue
    }
    if (internalTargets.has(node.id) && (node.kind === 'image' || node.kind === 'video')) {
      result.add(node.id)
      continue
    }
    if (internalTargets.has(node.id) && isWorkflowAiTextTaskNode(node)) {
      result.add(node.id)
    }
  }

  return result
}

/** 从接口记录或本地技能解析元素组结构 */
export function parseElementGroupRecord(record: Record<string, unknown>): GroupSkillSubgraph | null {
  let structure = record.structureJson ?? record.projectStructure ?? record.structure
  if (typeof structure === 'string') {
    try {
      structure = JSON.parse(structure)
    } catch {
      return null
    }
  }
  if (!structure || typeof structure !== 'object') return null
  const cells = (structure as { cells?: unknown[] }).cells ?? []
  return parseElementGroupCells(cells)
}

function slugifySkillName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || `canvas-skill-${Date.now()}`
}

function inferSkillName(subgraph: GroupSkillSubgraph): string {
  const textNode = subgraph.nodes.find((node) => node.kind === 'text' && (node.title || node.content))
  if (textNode) {
    const base = (textNode.title || textNode.content).trim().slice(0, 24)
    if (base) return base
  }
  return `画布技能-${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`
}

function buildNodeStepSummary(node: GroupSkillNode, index: number): string {
  const lines = [`${index + 1}. **${KIND_LABELS[node.kind]}** (${node.id})`]
  if (node.title) lines.push(`   - 标题：${node.title}`)
  if (node.content) {
    const excerpt = node.content.length > 200 ? `${node.content.slice(0, 200)}...` : node.content
    lines.push(`   - 内容：${excerpt}`)
  }
  if (node.genPrompt) lines.push(`   - 生成提示词：${node.genPrompt}`)
  if (node.fileName) lines.push(`   - 文件：${node.fileName}`)
  return lines.join('\n')
}

export function buildGroupSkillMarkdown(
  subgraph: GroupSkillSubgraph,
  options: { name?: string; projectName?: string; description?: string; role?: string; tags?: string[] } = {},
): { content: string; skillName: string; fileName: string } {
  const skillName = options.name?.trim() || inferSkillName(subgraph)
  const slug = slugifySkillName(skillName)
  const description = options.description?.trim()
    || `从${options.projectName ? `「${options.projectName}」` : '画布'}导出的工作流技能，共 ${subgraph.nodes.length} 个节点、${subgraph.edges.length} 条连线。`
  const nodeIdToLabel = new Map(
    subgraph.nodes.map((node, index) => [node.id, `${KIND_LABELS[node.kind]}#${index + 1}`]),
  )
  const stepsSection = subgraph.nodes.map(buildNodeStepSummary).join('\n\n')
  const edgesSection = subgraph.edges.length
    ? subgraph.edges
        .map((edge) => `- ${nodeIdToLabel.get(edge.source) ?? edge.source} → ${nodeIdToLabel.get(edge.target) ?? edge.target}`)
        .join('\n')
    : '_（组内节点无连线）_'
  const workflowJson = JSON.stringify(
    {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      nodes: subgraph.nodes,
      edges: subgraph.edges,
    },
    null,
    2,
  )

  const content = `---
name: ${slug}
description: ${description}
source: daone-canvas
version: 1
nodeCount: ${subgraph.nodes.length}
edgeCount: ${subgraph.edges.length}
role: ${options.role || '自定义'}
tags: ${JSON.stringify(options.tags || [])}
---

# ${skillName}

${description}

## 执行步骤

按画布节点顺序整理如下，执行时请依次处理各节点输入输出：

${stepsSection}

## 节点关系

${edgesSection}

## 画布数据

以下为完整组内节点与连线 JSON，可用于恢复或复现该工作流：

\`\`\`json
${workflowJson}
\`\`\`
`

  return {
    content,
    skillName,
    fileName: `${slug}.md`,
  }
}

export function downloadTextFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.click()
  URL.revokeObjectURL(url)
}

export function createSkillFile(content: string, fileName: string): File {
  return new File([content], fileName, { type: 'text/markdown' })
}
