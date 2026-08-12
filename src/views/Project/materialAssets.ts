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
  /** 素材库资源 ID；数字人等接口可能与 id 不同，优先用此字段绑定画布节点 */
  assetId?: string
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
  const rawAssetId = item.assetId
  const assetId =
    rawAssetId != null && String(rawAssetId).trim()
      ? String(rawAssetId).trim()
      : undefined
  // 列表主键保留接口 id；绑定画布时再通过 resolveAssetBindId 优先取 assetId
  const id = String(item.id ?? assetId ?? '').trim()
  return {
    ...item,
    id,
    ...(assetId ? { assetId } : {}),
    type,
    previewUrl: item.previewUrl || item.url || '',
    url: item.url || item.previewUrl || '',
    favorited: Boolean(item.favorited),
  }
}

/** 解析素材拖入画布时应绑定到节点的资源 ID（优先 assetId，其次 id） */
export function resolveAssetBindId(item: Pick<AssetItem, 'id' | 'assetId'> | Pick<MaterialItem, 'id'>): string {
  if ('assetId' in item && item.assetId != null && String(item.assetId).trim()) {
    return String(item.assetId).trim()
  }
  return String(item.id ?? '').trim()
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
