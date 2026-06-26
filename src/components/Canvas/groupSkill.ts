import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData, NodeKind } from './constants'

export interface GroupSkillNode {
  id: string
  kind: NodeKind
  title: string
  content: string
  genPrompt?: string
  previewUrl?: string
  fileName?: string
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
}

export function extractGroupSubgraph(graph: Graph, nodeIds: string[]): GroupSkillSubgraph | null {
  const idSet = new Set(nodeIds)
  const nodes = nodeIds
    .map((id) => graph.getCellById(id))
    .filter((cell): cell is Node => cell != null && cell.isNode())
    .map((node) => {
      const data = node.getData() as CanvasNodeData
      const pos = node.getPosition()
      return {
        id: node.id,
        kind: data.kind,
        title: data.title || '',
        content: data.content || '',
        genPrompt: data.genPrompt,
        previewUrl: data.previewUrl,
        fileName: data.fileName,
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
