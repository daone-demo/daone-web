type JsonObject = Record<string, unknown>

/** 从 parameters 解析本次应发起的 generation-tasks 请求次数（count / videoCount）。 */
export function resolveGenerationTaskRequestCount(parameters?: JsonObject): number {
  if (!parameters || typeof parameters !== 'object') return 1
  const raw = parameters.count ?? parameters.videoCount
  const parsed = Math.floor(Number(raw))
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return parsed
}

/** 单次请求体强制 count / videoCount 为 1，避免后端忽略批量字段。 */
export function normalizeGenerationTaskParameters(parameters?: JsonObject): JsonObject | undefined {
  if (!parameters) return parameters
  const normalized: JsonObject = {
    ...parameters,
    count: 1,
  }
  if (parameters.videoCount !== undefined) {
    normalized.videoCount = 1
  }
  return normalized
}

/** 为 createGenerationTask 组装单次请求体（parameters 已归一化）。 */
export function normalizeGenerationTaskCreateRequest<T extends { parameters?: JsonObject }>(
  data: T,
): T {
  return {
    ...data,
    parameters: normalizeGenerationTaskParameters(data.parameters),
  }
}
