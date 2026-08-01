import type { ProjectTabKey } from './projectData'

export const MATERIAL_COLUMN_COUNT = 6
export const MATERIAL_PAGE_SIZE = 30
export const SCROLL_LOAD_THRESHOLD = 120

export function isMaterialListScope(scope: ProjectTabKey): boolean {
  return scope === 'CENTER' || scope === 'FAVORITE'
}

export type MaterialItem = {
  id: string
  type: 'IMAGE' | 'VIDEO'
  resourceUrl?: string
  coverUrl?: string
  title?: string
  authorName?: string
  favorited?: boolean
}

export type AssetItem = {
  id: string
  previewUrl?: string
  url?: string
  fileName?: string
  name?: string
  type?: string
  width?: number | null
  height?: number | null
  favorited?: boolean
}

export type PreviewItem = {
  id?: string
  type: 'IMAGE' | 'VIDEO'
  resourceUrl: string
  title: string
}

export function isVideoAsset(item: Pick<AssetItem, 'type'>): boolean {
  return String(item.type ?? '').toUpperCase() === 'VIDEO'
}

export function resolveAssetMediaUrl(item: AssetItem): string {
  if (isVideoAsset(item)) {
    return item.url || item.previewUrl || ''
  }
  return item.previewUrl || item.url || ''
}

export function resolveAssetTitle(item: AssetItem): string {
  return item.fileName || item.name || '素材'
}

export function normalizeAssetItem(item: AssetItem): AssetItem {
  const type = String(item.type ?? 'IMAGE').toUpperCase()
  return {
    ...item,
    type,
    previewUrl: item.previewUrl || item.url || '',
    url: item.url || item.previewUrl || '',
    favorited: Boolean(item.favorited),
  }
}

export function resolveMaterialMediaUrl(item: MaterialItem): string {
  return item.resourceUrl || item.coverUrl || ''
}

export function resolveMaterialTitle(item: MaterialItem): string {
  return item.title || item.authorName || '素材'
}

export function buildMaterialColumns<T>(items: T[], columnCount: number): T[][] {
  const count = Math.max(1, columnCount)
  const columns: T[][] = Array.from({ length: count }, () => [])
  items.forEach((item, index) => {
    columns[index % count]?.push(item)
  })
  return columns
}
