import type { GenerationTaskDetail, GenerationTaskResult } from './generationTaskTypes'

const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELED'])

export function isGenerationTaskTerminal(status: string) {
  return TERMINAL_STATUSES.has(status)
}

export function readResultField<T>(item: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const value = item[key]
    if (value !== undefined && value !== null && value !== '') {
      return value as T
    }
  }
  return undefined
}

function normalizeGenerationTaskResult(raw: unknown): GenerationTaskResult | null {
  if (!raw || typeof raw !== 'object') return null

  const item = raw as Record<string, unknown>
  const nestedAsset =
    item.asset && typeof item.asset === 'object' ? (item.asset as Record<string, unknown>) : null

  const assetId = String(
    readResultField<unknown>(item, 'assetId', 'asset_id', 'id') ??
      readResultField<unknown>(nestedAsset ?? {}, 'id', 'assetId', 'asset_id') ??
      '',
  ).trim()

  const previewUrl = String(
    readResultField<unknown>(item, 'previewUrl', 'preview_url', 'url', 'imageUrl', 'image_url') ??
      readResultField<unknown>(nestedAsset ?? {}, 'previewUrl', 'preview_url', 'url') ??
      '',
  ).trim()

  const type = String(readResultField<unknown>(item, 'type') ?? nestedAsset?.type ?? '').trim()
  const content = String(readResultField<unknown>(item, 'content') ?? '').trim()
  const fileName = String(
    readResultField<unknown>(item, 'fileName', 'file_name') ??
      readResultField<unknown>(nestedAsset ?? {}, 'fileName', 'file_name') ??
      '',
  ).trim()

  const width =
    readResultField<number | null>(item, 'width', 'videoWidth', 'video_width') ??
    readResultField<number | null>(nestedAsset ?? {}, 'width', 'videoWidth', 'video_width')
  const height =
    readResultField<number | null>(item, 'height', 'videoHeight', 'video_height') ??
    readResultField<number | null>(nestedAsset ?? {}, 'height', 'videoHeight', 'video_height')
  const durationSeconds =
    readResultField<number | null>(item, 'durationSeconds', 'duration_seconds', 'duration') ??
    readResultField<number | null>(nestedAsset ?? {}, 'durationSeconds', 'duration_seconds', 'duration')

  if (!previewUrl && !assetId && !content) return null

  return {
    assetId: assetId || undefined,
    type: type || undefined,
    previewUrl: previewUrl || undefined,
    url: previewUrl || undefined,
    content: content || undefined,
    width,
    height,
    durationSeconds,
    fileName: fileName || undefined,
  }
}

function unwrapGenerationTaskRecord(raw: Record<string, unknown>) {
  const nestedData = raw.data
  if (!nestedData || typeof nestedData !== 'object' || Array.isArray(nestedData)) {
    return raw
  }

  const nested = nestedData as Record<string, unknown>
  if (readResultField<unknown>(raw, 'status', 'id', 'progress') != null) {
    return raw
  }
  if (readResultField<unknown>(nested, 'status', 'id', 'progress') == null) {
    return raw
  }

  return nested
}

function parseGenerationTaskProgress(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const progressNum = Number(raw)
  if (!Number.isFinite(progressNum)) return undefined
  return Math.max(0, Math.min(100, Math.round(progressNum)))
}

export function normalizeGenerationTaskDetail(raw: unknown): GenerationTaskDetail {
  if (!raw || typeof raw !== 'object') {
    return { id: '', status: 'FAILED' }
  }

  const task = unwrapGenerationTaskRecord(raw as Record<string, unknown>)
  const resultsRaw = Array.isArray(task.results)
    ? task.results
    : Array.isArray(task.resultThumbnails)
      ? task.resultThumbnails
      : []
  const results = resultsRaw
    .map((item) => normalizeGenerationTaskResult(item))
    .filter((item): item is GenerationTaskResult => Boolean(item))

  const taskName = String(
    readResultField<unknown>(
      task,
      'taskName',
      'task_name',
      'currentTaskName',
      'current_task_name',
      'name',
    ) ?? '',
  ).trim()
  const capabilityName = String(
    readResultField<unknown>(task, 'capabilityName', 'capability_name') ?? '',
  ).trim()

  return {
    id: String(readResultField<unknown>(task, 'id') ?? ''),
    status: String(readResultField<unknown>(task, 'status', 'taskStatus') ?? '').toUpperCase(),
    progress: parseGenerationTaskProgress(readResultField<unknown>(task, 'progress', 'taskProgress')),
    taskName: taskName || undefined,
    capabilityName: capabilityName || undefined,
    results,
    error: (task.error as GenerationTaskDetail['error']) ?? null,
  }
}

export function pickImageGenerationResults(task: GenerationTaskDetail): GenerationTaskResult[] {
  return task.results?.filter((item) => item.previewUrl || item.assetId) ?? []
}

export function countImageGenerationResults(task: GenerationTaskDetail | unknown): number {
  const normalized = normalizeGenerationTaskDetail(task)
  return Math.max(1, pickImageGenerationResults(normalized).length)
}

export function pickPrimaryGenerationResult(task: GenerationTaskDetail): GenerationTaskResult | null {
  return pickImageGenerationResults(task)[0] ?? null
}

export function pickModelGenerationResult(task: GenerationTaskDetail): GenerationTaskResult | null {
  const results = task.results?.filter((item) => item.previewUrl || item.assetId) ?? []
  if (!results.length) return null

  const byType = results.find((item) => String(item.type || '').toUpperCase() === 'MODEL')
  if (byType) return byType

  const byExt = results.find((item) => /\.glb(\?|$)/i.test(item.previewUrl || item.url || ''))
  if (byExt) return byExt

  return results[0] ?? null
}

/** 优先取 type=VIDEO 的结果；否则回退到视频扩展名 URL */
export function pickVideoGenerationResult(task: GenerationTaskDetail): GenerationTaskResult | null {
  const results = task.results?.filter((item) => item.previewUrl || item.assetId || item.url) ?? []
  if (!results.length) return null

  const byType = results.find((item) => String(item.type || '').toUpperCase() === 'VIDEO')
  if (byType) return byType

  const byExt = results.find((item) => /\.(mp4|webm|mov)(\?|$)/i.test(item.previewUrl || item.url || ''))
  return byExt ?? results[0] ?? null
}

/** 优先取 type=TEXT 且带 content 的结果（如图片反推提示词） */
export function pickTextGenerationResult(task: GenerationTaskDetail): GenerationTaskResult | null {
  const results = task.results ?? []
  if (!results.length) return null

  const byType = results.find(
    (item) => String(item.type || '').toUpperCase() === 'TEXT' && String(item.content || '').trim(),
  )
  if (byType) return byType

  const withContent = results.find((item) => String(item.content || '').trim())
  return withContent ?? null
}
