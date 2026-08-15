export type StreamEvent = {
  event?: string
  id?: string
  role?: string
  content?: string
  iteration?: number
  tool?: string
  arguments?: {
    question?: string
    content?: string
    text?: string
    questionnaire?: {
      step?: number
      totalSteps?: number
      allowCustom?: boolean
      allowMulti?: boolean
      options?: Array<{ label?: string; value?: string; description?: string }>
      steps?: Array<{
        name?: string
        label?: string
        question?: string
        allowCustom?: boolean
        allowMulti?: boolean
        options?: Array<{ label?: string; value?: string; description?: string }>
      }>
    }
    [key: string]: unknown
  }
  generationTaskIds?: Array<string | number>
  mainTaskId?: string | number
  agentActions?: Array<{
    tool?: string
    type?: string
    status?: string
    summary?: string
    data?: {
      question?: string
      step?: number
      totalSteps?: number
      allowCustom?: boolean
      allowMulti?: boolean
      options?: Array<{ label?: string; value?: string; description?: string }>
      steps?: Array<{
        name?: string
        label?: string
        question?: string
        allowCustom?: boolean
        allowMulti?: boolean
        options?: Array<{ label?: string; value?: string; description?: string }>
      }>
      taskId?: string | number
      taskName?: string
      taskType?: string
      capabilityCode?: string
      nodeId?: string
    }
  }>
  agentStatus?: string
  success?: boolean
  summary?: string
  choices?: Array<{ delta?: { content?: string } }>
  delta?: { content?: string }
  message?: string
  text?: string
  taskId?: string | number
  status?: string
  statusLabel?: string
  detail?: string
  completed?: number
  total?: number
  currentTaskName?: string
  taskType?: string
  capabilityCode?: string
  nodeId?: string
  parentNodeId?: string
  taskName?: string
  prompt?: string
}

export const RUNNING_TASK_STATUSES = new Set(['RUNNING', 'PENDING', 'QUEUED', 'PROCESSING'])
export const TERMINAL_TASK_STATUSES = new Set([
  'SUCCEEDED',
  'SUCCESS',
  'FAILED',
  'ERROR',
  'CANCELLED',
  'CANCELED',
])

export function isRunningTaskStatus(status?: string) {
  return RUNNING_TASK_STATUSES.has(String(status || '').toUpperCase())
}

export function isTerminalTaskStatus(status?: string) {
  return TERMINAL_TASK_STATUSES.has(String(status || '').toUpperCase())
}

export function resolveTaskStatusTip(payload: StreamEvent): string {
  const detail = typeof payload.detail === 'string' ? payload.detail.trim() : ''
  const statusLabel = typeof payload.statusLabel === 'string' ? payload.statusLabel.trim() : ''
  const currentTaskName = typeof payload.currentTaskName === 'string'
    ? payload.currentTaskName.trim()
    : ''
  if (detail) return detail
  if (statusLabel && currentTaskName) return `${currentTaskName}：${statusLabel}`
  return statusLabel || currentTaskName || '处理中...'
}

export function collectGenerationTaskIds(payload: {
  generationTaskIds?: Array<string | number>
  mainTaskId?: string | number
  agentActions?: StreamEvent['agentActions']
}): string[] {
  const ids = new Set<string>()

  payload.generationTaskIds?.forEach((id) => {
    const normalized = String(id ?? '').trim()
    if (normalized) ids.add(normalized)
  })

  if (payload.mainTaskId != null) {
    const mainTaskId = String(payload.mainTaskId).trim()
    if (mainTaskId) ids.add(mainTaskId)
  }

  payload.agentActions?.forEach((action) => {
    if (action.type !== 'GENERATE_IMAGE' && action.tool !== 'generate_image') return
    const taskId = String(action.data?.taskId ?? '').trim()
    if (taskId) ids.add(taskId)
  })

  return Array.from(ids)
}

export function extractGenerateImageTip(payload: StreamEvent): string | undefined {
  const action = payload.agentActions?.find(
    (item) => item.type === 'GENERATE_IMAGE' || item.tool === 'generate_image',
  )
  if (!action) return undefined

  const taskName = String(action.data?.taskName ?? '').trim()
  const summary = String(action.summary ?? '').trim()
  if (taskName && summary) return `${taskName}：${summary}`
  return taskName || summary || '图片生成任务处理中...'
}

export function resolveStreamTaskName(payload: StreamEvent, taskId?: string | number): string {
  const direct = String(payload.taskName ?? '').trim()
  if (direct) return direct

  const current = String(payload.currentTaskName ?? '').trim()
  if (current) return current

  const normalizedTaskId = String(taskId ?? payload.taskId ?? '').trim()
  for (const action of payload.agentActions ?? []) {
    if (action.type !== 'GENERATE_IMAGE' && action.tool !== 'generate_image') continue
    const actionTaskId = String(action.data?.taskId ?? '').trim()
    if (normalizedTaskId && actionTaskId && actionTaskId !== normalizedTaskId) continue
    const actionTaskName = String(action.data?.taskName ?? '').trim()
    if (actionTaskName) return actionTaskName
  }

  return ''
}

export function parseStreamEvent(data: string): StreamEvent | null {
  try {
    return JSON.parse(data) as StreamEvent
  } catch {
    return data.trim() ? { event: 'delta', content: data } : null
  }
}

/** 合并 SSE event 行与 JSON 内 event 字段；兼容 task_created 仅带 taskId/nodeId 的载荷 */
export function resolveStreamEventName(payload: StreamEvent, sseEvent?: string): string {
  const fromPayload = String(payload.event ?? '').trim()
  if (fromPayload) return fromPayload

  const fromSse = String(sseEvent ?? '').trim()
  if (fromSse && fromSse !== 'message') return fromSse

  const taskId = String(payload.taskId ?? '').trim()
  if (
    taskId
    && !payload.status
    && (payload.nodeId || payload.parentNodeId)
    && (payload.taskType || payload.capabilityCode)
  ) {
    return 'task_created'
  }

  return fromSse
}

export function pickStreamText(payload: StreamEvent): string {
  return (
    payload.content
    || payload.text
    || payload.message
    || payload.arguments?.question
    || payload.arguments?.content
    || payload.arguments?.text
    || payload.delta?.content
    || payload.choices?.[0]?.delta?.content
    || ''
  )
}

export function isBalanceError(errorMessage: string) {
  return /余额|充值|insufficient/i.test(errorMessage)
}
