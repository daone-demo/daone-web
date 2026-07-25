export type ImageEditTextAction = 'replace' | 'add' | 'remove'

export interface ImageEditTextBBox {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageEditTextEntry {
  id: string
  text: string
  originalText: string
  isNew?: boolean
  bbox?: ImageEditTextBBox
}

export interface ImageEditTextChange {
  originalText: string
  text: string
  editAction: ImageEditTextAction
  bbox?: ImageEditTextBBox
}

function createEntryId() {
  return `edit-text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function toBBox(raw: Record<string, unknown>): ImageEditTextBBox | undefined {
  const x = Number(raw.x ?? raw.left)
  const y = Number(raw.y ?? raw.top)
  const width = Number(raw.width ?? raw.w)
  const height = Number(raw.height ?? raw.h)

  if ([x, y, width, height].every((value) => Number.isFinite(value))) {
    return { x, y, width, height }
  }

  const box = raw.box ?? raw.bbox ?? raw.rect
  if (Array.isArray(box) && box.length >= 4) {
    const [bx, by, bw, bh] = box.map((value) => Number(value))
    if ([bx, by, bw, bh].every((value) => Number.isFinite(value))) {
      return { x: bx, y: by, width: bw, height: bh }
    }
  }

  const position = raw.position ?? raw.points
  if (Array.isArray(position) && position.length >= 4) {
    const xs: number[] = []
    const ys: number[] = []
    for (let index = 0; index < position.length; index += 2) {
      const px = Number(position[index])
      const py = Number(position[index + 1])
      if (Number.isFinite(px) && Number.isFinite(py)) {
        xs.push(px)
        ys.push(py)
      }
    }
    if (xs.length && ys.length) {
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      return {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
      }
    }
  }

  return undefined
}

function normalizeOcrItem(raw: unknown): ImageEditTextEntry | null {
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return null
    return {
      id: createEntryId(),
      text,
      originalText: text,
    }
  }

  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const text = String(record.text ?? record.content ?? record.value ?? record.word ?? '').trim()
  if (!text) return null

  return {
    id: String(record.id ?? record.regionId ?? createEntryId()),
    text,
    originalText: text,
    bbox: toBBox(record),
  }
}

function collectOcrItems(payload: unknown): unknown[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload

  if (typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>

  const nested = record.data
  if (nested && nested !== payload) {
    return collectOcrItems(nested)
  }

  for (const key of ['items', 'textBlocks', 'regions', 'texts', 'blocks', 'lines', 'words', 'results']) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }

  return []
}

export function normalizeOcrRecognizeResult(payload: unknown): ImageEditTextEntry[] {
  const items = collectOcrItems(payload)
  const seen = new Set<string>()
  const entries: ImageEditTextEntry[] = []

  items.forEach((item) => {
    const entry = normalizeOcrItem(item)
    if (!entry) return
    const dedupeKey = `${entry.text}::${entry.bbox?.x ?? ''}:${entry.bbox?.y ?? ''}`
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)
    entries.push(entry)
  })

  return entries
}

export function createEmptyEditTextEntry(): ImageEditTextEntry {
  return {
    id: createEntryId(),
    text: '',
    originalText: '',
    isNew: true,
  }
}

export function collectImageEditTextChanges(
  entries: ImageEditTextEntry[],
  removedIds: Set<string>,
): ImageEditTextChange[] {
  const changes: ImageEditTextChange[] = []

  entries.forEach((entry) => {
    const text = entry.text.trim()
    if (entry.isNew) {
      if (!text) return
      changes.push({
        originalText: '',
        text,
        editAction: 'add',
        bbox: entry.bbox,
      })
      return
    }

    if (removedIds.has(entry.id)) {
      changes.push({
        originalText: entry.originalText,
        text: '',
        editAction: 'remove',
        bbox: entry.bbox,
      })
      return
    }

    if (text !== entry.originalText) {
      changes.push({
        originalText: entry.originalText,
        text,
        editAction: 'replace',
        bbox: entry.bbox,
      })
    }
  })

  return changes
}
