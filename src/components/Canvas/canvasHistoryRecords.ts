import type { ProjectVersionRecord } from '@/services/api'

export type HistoryRecordKind = 'image' | 'video' | 'text' | 'custom'

export type HistoryRecordTab = 'all' | HistoryRecordKind

export type HistoryRecord = {
  id: string
  kind: HistoryRecordKind
  summary: string
  time: string
  dateKey: string
  dateLabel: string
}

export type { ProjectVersionRecord }

export const HISTORY_RECORD_TABS: { key: HistoryRecordTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'text', label: '文字' },
  { key: 'custom', label: '自定义' },
]

export function mapCanvasSaveTypeToHistoryKind(type?: string): HistoryRecordKind {
  switch (String(type ?? '').trim().toUpperCase()) {
    case 'IMAGE':
      return 'image'
    case 'VIDEO':
      return 'video'
    case 'TEXT':
      return 'text'
    case 'CUSTOM':
      return 'custom'
    default:
      return 'custom'
  }
}

function formatHistoryDateKey(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatHistoryDateLabel(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '未知日期'
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${weekdays[date.getDay()]}`
}

function formatHistoryTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function mapProjectVersionToHistoryRecord(
  record: ProjectVersionRecord,
): HistoryRecord | null {
  const createdAt = record.createdAt?.trim() || ''
  const summary =
    record.description?.trim() ||
  (record.versionNo != null ? `版本 ${record.versionNo}` : `版本 ${record.id}`)

  return {
    id: String(record.id),
    kind: mapCanvasSaveTypeToHistoryKind(record.type),
    summary,
    time: createdAt ? formatHistoryTime(createdAt) : '',
    dateKey: createdAt ? formatHistoryDateKey(createdAt) : 'unknown',
    dateLabel: createdAt ? formatHistoryDateLabel(createdAt) : '未知日期',
  }
}

export function mapProjectVersionsToHistoryRecords(
  records: ProjectVersionRecord[] | null | undefined,
): HistoryRecord[] {
  if (!Array.isArray(records)) return []
  return records
    .map(mapProjectVersionToHistoryRecord)
    .filter((item): item is HistoryRecord => Boolean(item))
}
