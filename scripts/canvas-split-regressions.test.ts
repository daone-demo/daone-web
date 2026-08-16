import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeAssetId } from '../src/components/Canvas/lib/normalizeAssetId.ts'
import { canResizeImageNode } from '../src/components/Canvas/lib/canResizeImageNode.ts'
import { formatMarkDisplayLabel } from '../src/components/Canvas/lib/formatMarkDisplayLabel.ts'

test('normalizeAssetId 规范化字符串与有限数字', () => {
  assert.equal(normalizeAssetId('  abc  '), 'abc')
  assert.equal(normalizeAssetId(''), undefined)
  assert.equal(normalizeAssetId('   '), undefined)
  assert.equal(normalizeAssetId(42), '42')
  assert.equal(normalizeAssetId(Number.NaN), undefined)
  assert.equal(normalizeAssetId(null), undefined)
  assert.equal(normalizeAssetId(undefined), undefined)
})

test('canResizeImageNode 仅在可编辑预览图且有媒体尺寸时允许', () => {
  assert.equal(canResizeImageNode(undefined), false)
  assert.equal(
    canResizeImageNode({
      kind: 'image',
      mode: 'editor',
      previewUrl: 'https://example.com/a.png',
      mediaWidth: 800,
      mediaHeight: 600,
    }),
    true,
  )
  assert.equal(
    canResizeImageNode({
      kind: 'image',
      mode: 'picker',
      previewUrl: 'https://example.com/a.png',
      mediaWidth: 800,
      mediaHeight: 600,
    }),
    false,
  )
  assert.equal(
    canResizeImageNode({
      kind: 'image',
      mode: 'editor',
      previewUrl: 'https://example.com/a.png',
      mediaWidth: 800,
      mediaHeight: 600,
      uploadState: 'uploading',
    }),
    false,
  )
  assert.equal(
    canResizeImageNode({
      kind: 'image',
      mode: 'editor',
      previewUrl: 'https://example.com/a.png',
      mediaWidth: 800,
      mediaHeight: 600,
      compactPreview: true,
    }),
    false,
  )
  assert.equal(
    canResizeImageNode({
      kind: 'image',
      mode: 'editor',
      previewUrl: 'https://example.com/a.png',
      mediaWidth: 800,
      mediaHeight: 600,
      compactPreview: true,
      gridSplitTile: true,
    }),
    true,
  )
})

test('formatMarkDisplayLabel 按 marks 顺序编号', () => {
  const marks = [
    { id: 'a', label: '猫' },
    { id: 'b', label: '狗', pending: true },
  ]
  assert.equal(formatMarkDisplayLabel(marks[0]!, marks), '1. 猫')
  assert.equal(formatMarkDisplayLabel(marks[1]!, marks), '2. 识别中')
  assert.equal(formatMarkDisplayLabel({ id: 'c', label: '鸟' }, marks), '3. 鸟')
})
