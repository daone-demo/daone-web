/**
 * 图生视频多结果：中间过渡空壳视频节点可移除判定。
 * 运行：node --experimental-strip-types --test scripts/video-multi-gen-intermediate.test.ts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

type VideoData = {
  kind?: string
  mode?: string
  previewUrl?: string
  uploadState?: string
  generationTaskType?: string
  generationTaskId?: string
  videoSourceRefs?: Array<{ nodeId: string; previewUrl?: string; fileName?: string; assetId?: string }>
  sourceNodeId?: string
  sourcePreviewUrl?: string
  sourceAssetId?: string
  sourceFileName?: string
}

function isVideoNodeGenerating(data: VideoData | undefined): boolean {
  if (!data || data.kind !== 'video') return false
  return (
    data.uploadState === 'uploading' &&
    (data.generationTaskType === 'VIDEO' || Boolean(String(data.generationTaskId ?? '').trim()))
  )
}

/** 与 videoGen.isRemovableVideoMultiGenIntermediate 对齐 */
function isRemovableVideoMultiGenIntermediate(data: VideoData | null | undefined): boolean {
  if (!data || data.kind !== 'video') return false
  if (data.previewUrl?.trim()) return false
  if (isVideoNodeGenerating(data)) return false
  return data.mode === 'picker' || !data.previewUrl?.trim()
}

/** 与 videoGen.removeVideoMultiGenIntermediateIfNeeded 对齐的精简模型 */
function removeVideoMultiGenIntermediateIfNeeded(
  graph: { getCellById: (id: string) => unknown; removeCell: (id: string) => void },
  sourceNode: { id: string; getData: () => VideoData },
  resultNodes: Array<{
    id: string
    getData: () => VideoData
    setData: (data: VideoData) => void
  }>,
): boolean {
  if (!Array.isArray(resultNodes) || resultNodes.length <= 1) return false
  if (resultNodes.some((node) => node.id === sourceNode.id)) return false
  const sourceData = sourceNode.getData()
  if (!isRemovableVideoMultiGenIntermediate(sourceData)) return false

  const removedId = sourceNode.id
  const firstRef = Array.isArray(sourceData.videoSourceRefs)
    ? sourceData.videoSourceRefs.find((item) => Boolean(item?.nodeId))
    : undefined

  for (const node of resultNodes) {
    const data = { ...node.getData() }
    if (data.sourceNodeId !== removedId) continue
    if (firstRef?.nodeId) {
      data.sourceNodeId = firstRef.nodeId
      data.sourcePreviewUrl = firstRef.previewUrl ?? ''
      data.sourceFileName = firstRef.fileName ?? data.sourceFileName
      if (firstRef.assetId) data.sourceAssetId = firstRef.assetId
      else delete data.sourceAssetId
    } else {
      delete data.sourceNodeId
      data.sourcePreviewUrl = ''
      delete data.sourceAssetId
    }
    node.setData(data)
  }

  if (graph.getCellById(removedId)) {
    graph.removeCell(removedId)
  }
  return true
}

test('picker 无成片：可移除中间过渡态', () => {
  assert.equal(isRemovableVideoMultiGenIntermediate({ kind: 'video', mode: 'picker' }), true)
})

test('已有成片预览：不可移除（保留向右长出结果）', () => {
  assert.equal(
    isRemovableVideoMultiGenIntermediate({
      kind: 'video',
      mode: 'editor',
      previewUrl: 'https://cdn.example/a.mp4',
    }),
    false,
  )
})

test('生成中：不可移除', () => {
  assert.equal(
    isRemovableVideoMultiGenIntermediate({
      kind: 'video',
      mode: 'editor',
      uploadState: 'uploading',
      generationTaskType: 'VIDEO',
      generationTaskId: 't1',
    }),
    false,
  )
})

test('单结果不移除；多结果移除空壳并改挂 sourceNodeId', () => {
  const removed: string[] = []
  const graph = {
    getCellById(id: string) {
      return id === 'mid' ? { id: 'mid' } : null
    },
    removeCell(id: string) {
      removed.push(id)
    },
  }
  const sourceNode = {
    id: 'mid',
    getData: () => ({
      kind: 'video' as const,
      mode: 'picker' as const,
      videoSourceRefs: [
        { nodeId: 'img1', previewUrl: 'https://cdn.example/1.png', fileName: 'a.png', assetId: 'a1' },
      ],
    }),
  }
  const resultUpdates: VideoData[] = []
  const resultNode = {
    id: 'r1',
    getData: () => ({
      kind: 'video' as const,
      mode: 'editor' as const,
      uploadState: 'uploading' as const,
      generationTaskType: 'VIDEO' as const,
      sourceNodeId: 'mid',
    }),
    setData(data: VideoData) {
      resultUpdates.push(data)
    },
  }

  assert.equal(
    removeVideoMultiGenIntermediateIfNeeded(graph, sourceNode, [resultNode]),
    false,
    '单结果 no-op',
  )
  assert.deepEqual(removed, [])

  const ok = removeVideoMultiGenIntermediateIfNeeded(graph, sourceNode, [
    resultNode,
    {
      id: 'r2',
      getData: () => ({ kind: 'video', sourceNodeId: 'mid' }),
      setData() {},
    },
  ])
  assert.equal(ok, true)
  assert.deepEqual(removed, ['mid'])
  assert.equal(resultUpdates[0]?.sourceNodeId, 'img1')
  assert.equal(resultUpdates[0]?.sourcePreviewUrl, 'https://cdn.example/1.png')
})

test('源码已接入移除逻辑，且保留单结果 / 成片分支', () => {
  const videoGen = fs.readFileSync(path.join(root, 'src/components/Canvas/videoGen.ts'), 'utf8')
  const dialogue = fs.readFileSync(
    path.join(root, 'src/components/Canvas/composables/useCanvas/runtime/mediaGeneration/dialogueSubmits.ts'),
    'utf8',
  )
  const toolbar = fs.readFileSync(
    path.join(root, 'src/components/Canvas/composables/useCanvas/runtime/mediaGeneration/videoToolbarGeneration.ts'),
    'utf8',
  )
  assert.match(videoGen, /export function isRemovableVideoMultiGenIntermediate/)
  assert.match(videoGen, /export function removeVideoMultiGenIntermediateIfNeeded/)
  assert.match(dialogue, /removeVideoMultiGenIntermediateIfNeeded\(g, sourceNode, resultNodes\)/)
  assert.match(toolbar, /removeVideoMultiGenIntermediateIfNeeded\(g, sourceNode, resultNodes\)/)
  // 单结果路径仍在
  assert.match(dialogue, /const reusableNode = findReusableVideoGenerationNode/)
  assert.match(toolbar, /requestedCount === 1 \? findReusableVideoGenerationNode/)
})
