/** 将任务类型与描述合并为画布保存用的 description 字段 */
export function formatCanvasDescription(taskType: string, description: string) {
  const text = description.trim()
  if (!text) return ''
  const type = taskType.trim()
  return type ? `[${type}] ${text}` : text
}

export function resolveVideoTaskTypeLabel(mode?: string) {
  switch (mode) {
    case 'text-to-video':
      return '文生视频'
    case 'reference':
      return '全能参考'
    case 'image-to-video':
      return '图生视频'
    case 'first-last-frame':
      return '首尾帧'
    case 'image-ref':
    case 'imageRef':
      return '图片参考'
    default:
      return '视频生成'
  }
}
