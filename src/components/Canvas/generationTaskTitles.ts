import type { GenerationTaskDetail } from './generationTaskTypes'

const GENERATION_PLACEHOLDER_TITLES = new Set(['生成中', '生成结果'])

/** Agent / 画布生成任务占位标题，不应作为完成态节点标题 */
export function isGenerationProgressTitle(title?: string) {
  const normalized = String(title ?? '').trim()
  return !normalized || GENERATION_PLACEHOLDER_TITLES.has(normalized)
}

/** 完成态标题：跳过占位文案，优先使用真实任务名 */
export function resolveGenerationResultTitle(
  ...candidates: Array<string | undefined>
) {
  return resolveGenerationResultTitleWithFallback('生成结果', ...candidates)
}

export function resolveGenerationResultTitleWithFallback(
  fallback: string,
  ...candidates: Array<string | undefined>
) {
  for (const candidate of candidates) {
    const normalized = String(candidate ?? '').trim()
    if (normalized && !isGenerationProgressTitle(normalized)) {
      return normalized
    }
  }
  return fallback
}

export function pickGenerationTaskName(task: GenerationTaskDetail | null | undefined) {
  if (!task) return ''
  return String(task.taskName ?? task.capabilityName ?? '').trim()
}
