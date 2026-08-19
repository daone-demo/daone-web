export const PROJECT_TABS = [
  { key: 'CENTER', label: '素材中心' },
  { key: 'FAVORITE', label: '我的收藏' },
  { key: 'FILES', label: '我的文件' },
  { key: 'DIGITAL_HUMAN', label: '我的数字人' },
] as const

/** 含画布素材面板使用的 CENTER（与项目页 CACHE 并存） */
export type ProjectTabKey = (typeof PROJECT_TABS)[number]['key'] | 'CENTER'

export type AssetsFileType = 'all' | 'image' | 'video'

export const ASSETS_TYPE_OPTIONS: Array<{ label: string; value: AssetsFileType }> = [
  { label: '全部', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
]

export function normalizeAssetDateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  if (typeof value === 'object' && value !== null && 'format' in value) {
    const format = (value as { format?: (pattern: string) => string }).format
    return typeof format === 'function' ? format('YYYY-MM-DD') : null
  }
  return null
}
