/**
 * coreHelpers.ts
 * 画布 registerCore 的纯/半纯工具函数。
 * 无 Vue 响应式依赖、无 graph 副作用，可被任意 register* 模块安全复用。
 */

import type { CanvasNodeData } from '../../constants'
import { getNodeSize } from '../../graph'
import type { UploadFilter } from './state'

/** 判断文件是否可作为图片上传 */
export function isImageUploadFile(file: File) {
  return (
    file.type.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)$/i.test(file.name)
  )
}

/** 判断文件是否可作为视频上传 */
export function isVideoUploadFile(file: File) {
  return (
    file.type.startsWith('video/') ||
    /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(file.name)
  )
}

/** 按上传过滤器筛选文件列表 */
export function filterUploadFiles(files: File[], filter: UploadFilter) {
  return files.filter((file) => {
    if (filter === 'image') return isImageUploadFile(file)
    if (filter === 'video') return isVideoUploadFile(file)
    return isImageUploadFile(file) || isVideoUploadFile(file)
  })
}

/** 抠图模式文案归一化为内部枚举 */
export function normalizeCutoutMode(option?: string) {
  if (!option) return 'quick'
  if (option === '快速') return 'quick'
  if (option === '精准') return 'precise'
  if (option === '擦除') return 'erase'
  return option
}

/**
 * 多结果生成时为第 index 个结果生成文件名。
 * total <= 1 时保持原始文件名。
 */
export function resolveGenerationResultFileName(
  buildFileName: (sourceFileName: string) => string,
  sourceFileName: string,
  index: number,
  total: number,
) {
  const base = buildFileName(sourceFileName)
  if (total <= 1) return base
  const dot = base.lastIndexOf('.')
  if (dot > 0) {
    return `${base.slice(0, dot)}-${index + 1}${base.slice(dot)}`
  }
  return `${base}-${index + 1}`
}

/** 根据视频节点宽高比计算结果占位尺寸 */
export function resolveVideoResultLayoutSize(sourceData: CanvasNodeData) {
  const ratio =
    sourceData.videoGenAspectRatio ||
    sourceData.videoDialogueSettings?.aspectRatio
  return getNodeSize('video', 'editor', {
    kind: 'video',
    mode: 'editor',
    uploadState: 'uploading',
    generationTaskType: 'VIDEO',
    videoGenAspectRatio: ratio,
  })
}

/** 纯文本转文本节点可编辑 HTML（按行包 <p>） */
export function plainTextToEditorHtml(text: string) {
  return text
    .split('\n')
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('')
}
