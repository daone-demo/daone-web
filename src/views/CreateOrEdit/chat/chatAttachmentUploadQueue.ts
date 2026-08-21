/**
 * 聊天附件上传队列：绑定 session/project/generation，避免跨会话丢任务或计数串扰。
 */

export type ChatUploadQueueItem = {
  attachmentId: string
  sessionId: string
  projectId: string
  generation: number
}

export type ChatUploadQueueState = {
  generation: number
  activeCount: number
  items: ChatUploadQueueItem[]
}

export function createChatUploadQueueState(): ChatUploadQueueState {
  return { generation: 0, activeCount: 0, items: [] }
}

export function bumpUploadQueueGeneration(state: ChatUploadQueueState): ChatUploadQueueState {
  return {
    generation: state.generation + 1,
    activeCount: 0,
    items: [],
  }
}

export function enqueueChatUpload(
  state: ChatUploadQueueState,
  item: Omit<ChatUploadQueueItem, 'generation'>,
): ChatUploadQueueState {
  const generation = state.generation
  if (
    state.items.some(
      (row) =>
        row.attachmentId === item.attachmentId &&
        row.sessionId === item.sessionId &&
        row.generation === generation,
    )
  ) {
    return state
  }
  return {
    ...state,
    items: [...state.items, { ...item, generation }],
  }
}

export function removeChatUploadFromQueue(
  state: ChatUploadQueueState,
  attachmentId: string,
): ChatUploadQueueState {
  return {
    ...state,
    items: state.items.filter((row) => row.attachmentId !== attachmentId),
  }
}

export type ChatUploadPumpResult = {
  state: ChatUploadQueueState
  /** 本轮可启动的任务（调用方负责执行并在 finally 调用 complete） */
  started: ChatUploadQueueItem[]
}

/**
 * 取出可启动任务；找不到附件的项会被跳过（由 hasAttachment 判定）。
 */
export function pumpChatUploadQueue(
  state: ChatUploadQueueState,
  hasAttachment: (item: ChatUploadQueueItem) => boolean,
  maxConcurrency: number,
): ChatUploadPumpResult {
  const items = [...state.items]
  const started: ChatUploadQueueItem[] = []
  let activeCount = state.activeCount

  while (activeCount < maxConcurrency && items.length) {
    const next = items.shift()!
    if (next.generation !== state.generation) continue
    if (!hasAttachment(next)) continue
    started.push(next)
    activeCount += 1
  }

  return {
    state: { ...state, items, activeCount },
    started,
  }
}

/** 仅当 generation 未变时回写并发计数并允许继续泵 */
export function completeChatUploadSlot(
  state: ChatUploadQueueState,
  generation: number,
): ChatUploadQueueState {
  if (generation !== state.generation) return state
  return {
    ...state,
    activeCount: Math.max(0, state.activeCount - 1),
  }
}
