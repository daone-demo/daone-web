import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData, ImageSourceRef } from './constants'
import { connectGenEdge } from './imageGen'

export const IMG2PROMPT_DEFAULT_INSTRUCTION =
  '根据图片生成结构化中文提示词，包括主体描述、环境、光影、镜头语言、风格关键词。'

export function findLinkedImageNode(graph: Graph, textNodeId: string): Node | null {
  for (const edge of graph.getEdges()) {
    const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()
    if (!sourceId || !targetId) continue

    let imageId = ''
    let textId = ''
    if (sourceId === textNodeId) {
      textId = sourceId
      imageId = targetId
    } else if (targetId === textNodeId) {
      textId = targetId
      imageId = sourceId
    } else {
      continue
    }

    const imageCell = graph.getCellById(imageId)
    if (!imageCell?.isNode()) continue
    const data = imageCell.getData() as CanvasNodeData
    if (data.kind !== 'image' || !data.previewUrl) continue
    if (textId !== textNodeId) continue
    return imageCell as Node
  }
  return null
}

export const findIncomingImageNode = findLinkedImageNode

/** 收集与文本节点相连的所有图片节点（用于多图参考），按连线顺序去重 */
export function collectLinkedImageNodes(graph: Graph, textNodeId: string): Node[] {
  const result: Node[] = []
  const seen = new Set<string>()
  for (const edge of graph.getEdges()) {
    const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()
    if (!sourceId || !targetId) continue

    let imageId = ''
    if (sourceId === textNodeId) imageId = targetId
    else if (targetId === textNodeId) imageId = sourceId
    else continue
    if (seen.has(imageId)) continue

    const imageCell = graph.getCellById(imageId)
    if (!imageCell?.isNode()) continue
    const data = imageCell.getData() as CanvasNodeData
    if (data.kind !== 'image' || !data.previewUrl) continue

    seen.add(imageId)
    result.push(imageCell as Node)
  }
  return result
}

export function syncTextNodeImageSource(
  graph: Graph,
  textNode: Node,
  imageNode?: Node | null,
): CanvasNodeData {
  const data = { ...(textNode.getData() as CanvasNodeData) }

  const linkedNodes = collectLinkedImageNodes(graph, textNode.id)
  // 确保显式传入的图片节点也被纳入（去重）
  if (imageNode && !linkedNodes.some((node) => node.id === imageNode.id)) {
    const imgData = imageNode.getData() as CanvasNodeData
    if (imgData.kind === 'image' && imgData.previewUrl) linkedNodes.push(imageNode)
  }

  if (linkedNodes.length) {
    const refs: ImageSourceRef[] = linkedNodes.map((node) => {
      const imageData = node.getData() as CanvasNodeData
      return {
        nodeId: node.id,
        previewUrl: imageData.previewUrl ?? '',
        fileName: imageData.fileName ?? '',
      }
    })
    const latest = refs[refs.length - 1]
    data.imageSourceRefs = refs
    data.linkedImageNodeId = latest.nodeId
    data.sourcePreviewUrl = latest.previewUrl
    data.sourceFileName = latest.fileName
    // overwrite: true —— 避免 X6 默认深合并对数组按索引合并
    textNode.setData(data, { overwrite: true })
  }

  return textNode.getData() as CanvasNodeData
}

export function syncTextNodesFromImageSource(graph: Graph, imageNode: Node) {
  graph.getNodes().forEach((node) => {
    const data = node.getData() as CanvasNodeData
    if (data.kind !== 'text') return
    if (
      data.linkedImageNodeId === imageNode.id ||
      findLinkedImageNode(graph, node.id)?.id === imageNode.id
    ) {
      syncTextNodeImageSource(graph, node, imageNode)
    }
  })
}

export function mockTextGenerate(prompt: string): Promise<string> {
  const seed = prompt.trim()
  const body = [
    `故事梗概：${seed}`,
    '',
    '第一章 · 重启',
    '清晨的阳光透过老式窗框洒进房间，空气里混着记忆与现实的错位感。主角在熟悉的街景与陌生的细节之间，逐渐确认自己真的回到了那个关键的年代。',
    '',
    '第二章 · 抉择',
    '凭借来自未来的片段记忆，TA开始在学业、人际与命运岔路口做出不同于前世的判断。每一次选择都在悄悄改写原本既定的人生轨迹。',
    '',
    '第三章 · 暗涌',
    '变化并未被所有人欣然接受。旧日的关系、隐藏的利益与时代局限陆续浮现，主角必须在保守与冒险之间找到属于自己的节奏。',
    '',
    '尾声 · 新生',
    '当熟悉的年份再次来临，世界似乎与记忆中重合，却又处处不同。那些曾经以为无法改变的遗憾，正在以另一种方式被温柔地弥补。',
  ].join('\n')

  return new Promise((resolve) => {
    window.setTimeout(() => resolve(body), 3200)
  })
}

export function mockImg2Prompt(
  instruction: string,
  source: {
    previewUrl?: string
    fileName?: string
    mediaWidth?: number
    mediaHeight?: number
  },
): Promise<string> {
  void instruction
  void source
  const body = [
    '主体描述：画面主体清晰突出，造型完整、细节丰富，材质纹理与光泽质感真实，整体层次分明。',
    '环境：背景空间层次清晰，元素布局协调，色调统一，营造出契合主体的氛围与景深。',
    '光影：自然光照明，明暗对比柔和，高光与阴影过渡自然，立体感与质感表现到位。',
    '镜头语言：中景构图，主体居中，视角平稳，景深适中，画面比例均衡。',
    '风格关键词：写实、电影感、高质感、色彩统一、画面精致。',
  ].join('\n')

  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve(body)
    }, 2600)
  })
}

export async function runImg2Prompt(
  graph: Graph,
  textNode: Node,
  instruction = IMG2PROMPT_DEFAULT_INSTRUCTION,
): Promise<string> {
  const imageNode = findLinkedImageNode(graph, textNode.id)
  if (!imageNode) {
    throw new Error('请先连接一张图片节点')
  }

  syncTextNodeImageSource(graph, textNode, imageNode)

  const data = { ...(textNode.getData() as CanvasNodeData) }
  data.textGenState = 'loading'
  textNode.setData(data)

  const imageData = imageNode.getData() as CanvasNodeData
  const prompt = await mockImg2Prompt(instruction, {
    previewUrl: imageData.previewUrl,
    fileName: imageData.fileName,
    mediaWidth: imageData.mediaWidth,
    mediaHeight: imageData.mediaHeight,
  })

  const next = { ...(textNode.getData() as CanvasNodeData) }
  next.textGenState = 'done'
  next.content = prompt
  next.mode = 'editor'
  next.textPickerTask = ''
  textNode.setData(next)
  return prompt
}

export function ensureImageTextEdge(graph: Graph, imageNodeId: string, textNodeId: string) {
  const exists = graph.getEdges().some((edge) => {
    const s = edge.getSourceCellId()
    const t = edge.getTargetCellId()
    return (
      (s === imageNodeId && t === textNodeId) ||
      (s === textNodeId && t === imageNodeId)
    )
  })
  if (!exists) {
    connectGenEdge(graph, imageNodeId, textNodeId)
  }
}
