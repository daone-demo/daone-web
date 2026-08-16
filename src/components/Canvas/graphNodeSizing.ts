import {
  NODE_SIZE,
  type CanvasNodeData,
  type NodeKind,
  type NodeMode,
  getImageAdaptiveNodeSize,
  shouldAdaptImageGenerationPlaceholder,
  shouldAdaptImageNodeHeight,
  getVideoAdaptiveNodeSize,
  shouldAdaptVideoNodeHeight,
  computeVideoNodeSizeByAspectRatio,
} from './constants'

export function getBaseNodeSize(
  kind: NodeKind,
  mode: NodeMode = 'picker',
  data?: Partial<CanvasNodeData>,
) {
  if (kind === 'text' || kind === 'audio') {
    if (mode === 'editor') {
      const base = NODE_SIZE.text.editor
      return {
        width: data?.editorWidth ?? base.width,
        height: data?.editorHeight ?? base.height,
      }
    }
    return NODE_SIZE.text.picker
  }
  if (kind === 'video') {
    const hasPreview = Boolean(data?.previewUrl?.trim())
    const isGenerating =
      data?.uploadState === 'uploading' &&
      (data?.generationTaskType === 'VIDEO' || Boolean(data?.generationTaskId))
    const ratio = data?.videoGenAspectRatio

    if (ratio && ratio !== 'auto' && (!hasPreview || isGenerating || data.videoGenAspectRatio)) {
      return computeVideoNodeSizeByAspectRatio(ratio)
    }
    if (data && shouldAdaptVideoNodeHeight(data)) {
      return getVideoAdaptiveNodeSize(data)
    }
    if (mode === 'picker' || !hasPreview) return NODE_SIZE.video.picker
    return NODE_SIZE.video.media
  }
  if (kind === 'model3d') {
    return NODE_SIZE.model3d.editor
  }
  if (kind === 'image') {
    if (data && shouldAdaptImageGenerationPlaceholder(data)) {
      return getImageAdaptiveNodeSize(data)
    }
    if (data?.editorWidth && data?.editorHeight) {
      return {
        width: data.editorWidth,
        height: data.editorHeight,
      }
    }
    if (data && shouldAdaptImageNodeHeight(data)) {
      return getImageAdaptiveNodeSize(data)
    }
    if (data?.imageGenTask === 'picker') return NODE_SIZE.image.genPicker
    if (data?.imageGenTask === 'img2img') return NODE_SIZE.image.img2img
    if (data?.imageGenTask === 'hd') return NODE_SIZE.image.hd
    return NODE_SIZE.image.landscape
  }
  return NODE_SIZE.image.landscape
}
