import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

const overlayFiles = [
  'ImageCropOverlay.vue',
  'ImageGridSplitOverlay.vue',
  'ImageEraseOverlay.vue',
  'ImageInpaintOverlay.vue',
  'ImageExpandOverlay.vue',
  'ImageEditTextPanel.vue',
]

test('图片编辑面板按功能异步加载，不再静态进入 Canvas 基础模块', () => {
  const overlaysSrc = readSrc('src/components/Canvas/panels/CanvasNodeOverlays.vue')
  for (const file of overlayFiles) {
    assert.equal(
      overlaysSrc.includes(`import ${file.replace('.vue', '')} from '../${file}'`),
      false,
      `${file} 不得静态 import`,
    )
    assert.match(
      overlaysSrc,
      new RegExp(`defineAsyncComponent\\(\\(\\) => import\\('\\.\\./${file}'\\)\\)`),
    )
  }
})

test('图片编辑非 scoped 样式挂在 .canvas 命名空间下', () => {
  const styleFiles = [
    ['src/components/Canvas/styles/canvas-image-crop.scss', '.image-crop-overlay'],
    ['src/components/Canvas/styles/canvas-image-erase.scss', '.image-erase-overlay'],
    ['src/components/Canvas/styles/canvas-image-inpaint.scss', '.image-inpaint-overlay'],
    ['src/components/Canvas/styles/canvas-image-expand.scss', '.image-expand-overlay'],
    ['src/components/Canvas/styles/canvas-image-grid-split.scss', '.image-grid-split-overlay'],
    ['src/components/Canvas/styles/canvas-image-edit-text.scss', '.image-edit-text-panel'],
  ] as const

  for (const [rel, selector] of styleFiles) {
    const src = readSrc(rel)
    assert.match(src, /\.canvas \{/)
    assert.match(src, new RegExp(selector.replace('.', '\\.')))
    assert.doesNotMatch(
      src,
      new RegExp(`^${selector.replace('.', '\\.')}`, 'm'),
      `${rel} 顶层不得再暴露全局选择器`,
    )
  }
})
