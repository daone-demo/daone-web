import assert from 'node:assert/strict'
import { test } from 'node:test'

/**
 * 与 graphNodeSizing.getBaseNodeSize 中视频分支保持一致：
 * 已有预览且非生成中时，不因 videoGenAspectRatio 改用生成比例尺寸。
 */
function shouldUseVideoAspectRatioSize(data: {
  previewUrl?: string
  uploadState?: string
  generationTaskType?: string
  generationTaskId?: string
  videoGenAspectRatio?: string
}): boolean {
  const hasPreview = Boolean(data.previewUrl?.trim())
  const isGenerating =
    data.uploadState === 'uploading' &&
    (data.generationTaskType === 'VIDEO' || Boolean(data.generationTaskId))
  const ratio = data.videoGenAspectRatio
  return Boolean(ratio && ratio !== 'auto' && (!hasPreview || isGenerating))
}

test('已有预览的视频：写入 videoGenAspectRatio 不应改用生成比例尺寸', () => {
  assert.equal(
    shouldUseVideoAspectRatioSize({
      previewUrl: 'https://example.com/a.mp4',
      videoGenAspectRatio: '16:9',
    }),
    false,
  )
})

test('生成中/无预览：仍按 videoGenAspectRatio 占位', () => {
  assert.equal(
    shouldUseVideoAspectRatioSize({
      uploadState: 'uploading',
      generationTaskType: 'VIDEO',
      generationTaskId: 't1',
      videoGenAspectRatio: '9:16',
    }),
    true,
  )
  assert.equal(
    shouldUseVideoAspectRatioSize({
      videoGenAspectRatio: '9:16',
    }),
    true,
  )
})
