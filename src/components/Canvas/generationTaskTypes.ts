export type GenerationTaskResult = {
  assetId?: string
  type?: string
  previewUrl?: string
  url?: string
  content?: string
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  fileName?: string
}

export type GenerationTaskDetail = {
  id: string
  status: string
  progress?: number
  taskName?: string
  capabilityName?: string
  results?: GenerationTaskResult[]
  error?: { code?: string; message?: string } | null
}

export type GenerationTaskType = 'IMAGE' | 'TEXT' | 'MODEL' | 'VIDEO'

export type ImageGenerationOnNodeResult = {
  success: boolean
  extraResults?: GenerationTaskResult[]
  allResults?: GenerationTaskResult[]
  resultCount?: number
}
