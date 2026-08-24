/**
 * 多图/多视频结果之间不应连 sibling 边。
 * 运行：node --experimental-strip-types --test scripts/multi-result-sibling-edge.test.ts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

test('spawnGenerationResultNode / spawnVideoGenerationResultNode 支持 connectFromSource', () => {
  const src = read('src/components/Canvas/imageGen.ts')
  assert.match(src, /connectFromSource\?: boolean/)
  assert.match(src, /if \(options\.connectFromSource !== false\) \{\s*connectGenEdge\(graph, sourceNode\.id, node\.id\)/)
  // 视频 spawn 同样支持
  assert.equal((src.match(/connectFromSource\?: boolean/g) || []).length >= 2, true)
})

test('复用首个结果再长出其余结果时关闭 sibling 连线', () => {
  const dialogue = read(
    'src/components/Canvas/composables/useCanvas/runtime/mediaGeneration/dialogueSubmits.ts',
  )
  const installDialogue = read(
    'src/components/Canvas/composables/useCanvas/runtime/installDialogue.ts',
  )
  assert.match(dialogue, /connectFromSource:\s*false/)
  assert.match(installDialogue, /connectFromSource:\s*false/)
  // 从真实素材源长出结果时仍默认连边（不写 false）
  assert.match(
    dialogue,
    /else \{\s*const batchPreviewSize = getImageGenerationPlaceholderSize\(sourceNode\);[\s\S]*?spawnGenerationResultNode\(g, sourceNode, \{[\s\S]*?layoutTotal: requestedCount,\s*\}\)/,
  )
})
