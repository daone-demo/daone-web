export type ResizeImageNodeLike = {
  kind?: string
  mode?: string
  previewUrl?: string
  compactPreview?: boolean
  gridSplitTile?: unknown
  uploadState?: string
  imageGenState?: string
  mediaWidth?: number
  mediaHeight?: number
}

export function canResizeImageNode(data?: ResizeImageNodeLike) {
  if (!data || data.kind !== 'image') return false
  if (data.mode !== 'editor') return false
  if (!data.previewUrl?.trim()) return false
  if (data.compactPreview && !data.gridSplitTile) return false
  if (data.uploadState === 'uploading') return false
  if (data.imageGenState === 'loading') return false
  if (!data.mediaWidth || !data.mediaHeight) return false
  return true
}
