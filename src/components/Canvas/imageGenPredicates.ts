import type { CanvasNodeData } from './constants'

/** 待生成图片节点：尚无生成结果、可接收上游图源 */
export function isPendingImageGenerationTarget(data: CanvasNodeData): boolean {
  if (data.kind !== 'image') return false
  if (data.imageGenState === 'loading') return false
  if (data.imageGenState === 'done') return false
  if (data.generationTaskId) return false
  return (
    data.imageGenTask === 'picker' ||
    data.imageGenTask === 'img2img' ||
    data.mode === 'picker'
  )
}

/** 裁剪产物（含工作流恢复后可能丢失 cropResult 的节点） */
export function isCropDerivedImageData(data: CanvasNodeData | undefined) {
  if (!data || data.kind !== 'image') return false
  if (data.cropResult) return true
  const title = String(data.title ?? '').trim()
  if (title === '裁剪结果' || title.startsWith('裁剪-')) return true
  const fileName = String(data.fileName ?? '').trim()
  return fileName.startsWith('裁剪-') || fileName === '裁剪结果.png'
}

/** 生图进行中节点左上角标签：有图片输入源为图生图，否则为文生图 */
export function resolveImageGenerationProgressLabel(
  data: Partial<CanvasNodeData> | null | undefined,
): '文生图' | '图生图' {
  if (!data) return '文生图'
  if (data.imageGenTask === 'img2img') return '图生图'

  const hasImageInput = Boolean(
    data.sourcePreviewUrl?.trim() ||
      data.sourceAssetId?.trim() ||
      data.imageSourceRefs?.some((ref) => ref.assetId?.trim() || ref.previewUrl?.trim()) ||
      (data.generationParams?.referenceAssetIds?.length ?? 0) > 0,
  )

  return hasImageInput ? '图生图' : '文生图'
}

/** 图片生成失败、尚未成片的节点（可原地重试） */
export function isImageGenerationFailedNode(data: CanvasNodeData | undefined): boolean {
  if (!data || data.kind !== 'image') return false
  if (data.imageGenState === 'loading') return false
  if (data.imageGenState === 'failed') return true

  const markedFailed = data.title === '生成失败'
  if (!markedFailed) return false

  if (!data.previewUrl?.trim()) return true
  return data.title === '生成失败'
}

/** 无预览图的图生图上传占位节点（显示「点击或拖拽图片到此处上传」） */
export function isImageGenerationUploadPlaceholderNode(data: CanvasNodeData | undefined): boolean {
  if (!data || data.kind !== 'image') return false
  if (data.previewUrl?.trim()) return false
  if (data.uploadState === 'uploading' || data.imageGenState === 'loading') return false
  return data.mode === 'picker' || data.imageGenTask === 'picker' || data.imageGenTask === 'img2img'
}

/** 文生图占位节点：由文本连线拉出、尚无成片 */
export function isText2ImagePlaceholderNode(data: CanvasNodeData | undefined): boolean {
  if (!data || data.kind !== 'image') return false
  if (data.previewUrl?.trim()) return false
  if (data.uploadState === 'uploading' || data.imageGenState === 'loading') return false
  if (data.mode === 'editor' && data.imageGenTask === 'picker') return true
  return data.title === '文生图'
}

/** 图生图对话提交：仅上传占位 / 失败重试节点原地生成；已有成片的节点新建子节点 */
export function shouldGenerateImageInPlaceOnNode(
  data: CanvasNodeData,
  options: { requestedCount: number; hasReferenceImages: boolean },
): boolean {
  if (options.requestedCount !== 1 || data.kind !== 'image') return false
  if (data.previewUrl?.trim() && !isImageGenerationFailedNode(data)) return false

  if (options.hasReferenceImages) {
    return isImageGenerationUploadPlaceholderNode(data) || isImageGenerationFailedNode(data)
  }

  return isText2ImagePlaceholderNode(data) || isImageGenerationFailedNode(data)
}
