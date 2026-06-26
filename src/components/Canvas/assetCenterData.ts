import { parseElementGroupRecord } from './groupSkill'

export const ASSET_CENTER_TABS = [
  { key: 'ALL', label: '全部' },
  { key: '角色', label: '角色' },
  { key: '场景', label: '场景' },
  { key: '风格包', label: '风格包' },
  { key: '自定义', label: '自定义' },
] as const

export type AssetCenterTabKey = (typeof ASSET_CENTER_TABS)[number]['key']

export interface ElementGroupRecord {
  id: string | number
  name?: string
  projectName?: string
  structureJson?: unknown
  projectStructure?: unknown
  structure?: unknown
  role?: string
  [key: string]: unknown
}

export interface AssetCenterItem {
  id: string
  name: string
  role: string
  previewUrl?: string
  description?: string
}

export interface AssetCenterFilePreview {
  id: string
  fileName: string
  previewUrl?: string
  kind: string
}

export function getAssetCenterDisplayName(record: ElementGroupRecord): string {
  return String(record.name ?? record.projectName ?? '未命名')
}

export function getAssetCenterRole(record: ElementGroupRecord): string {
  const role = String(record.role ?? '').trim()
  return role || '自定义'
}

export function getAssetCenterPreviewUrl(record: ElementGroupRecord): string | undefined {
  const workflow = parseElementGroupRecord(record)
  if (!workflow) return undefined
  return workflow.nodes.find((node) => node.previewUrl)?.previewUrl
}

export function getAssetCenterFiles(record: ElementGroupRecord): AssetCenterFilePreview[] {
  const workflow = parseElementGroupRecord(record)
  if (!workflow) return []
  return workflow.nodes
    .filter((node) => node.previewUrl || node.fileName || node.title)
    .map((node, index) => ({
      id: node.id || `file-${index}`,
      fileName: node.fileName || node.title || '未命名',
      previewUrl: node.previewUrl,
      kind: node.kind,
    }))
}
