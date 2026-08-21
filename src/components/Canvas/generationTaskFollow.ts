import type { Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import type {
  GenerationTaskDetail,
  GenerationTaskResult,
  ImageGenerationOnNodeResult,
} from './generationTaskTypes'
import { pickGenerationTaskName, resolveGenerationResultTitle } from './generationTaskTitles'
import {
  isGenerationTaskTerminal,
  normalizeGenerationTaskDetail,
  pickModelGenerationResult,
  pickTextGenerationResult,
  pickVideoGenerationResult,
  pickImageGenerationResults,
} from './generationTaskNormalize'
import {
  isNodeOnGraph,
  getNodeGraph,
  updateTextGenerationNodeProgress,
  applyTextGenerationResultToNode,
  markTextGenerationNodeFailed,
  updateVideoGenerationNodeProgress,
  applyVideoGenerationResultToNode,
  markVideoGenerationNodeFailed,
  applyModelGenerationResultToNode,
  updateGenerationNodeProgress,
  applyGenerationResultToNode,
  markGenerationNodeFailed,
} from './generationTaskApply'
import {
  activePollingTaskOwners,
  generationPollEpoch,
  getGenerationTaskDetail,
  notifyGenerationTaskSettled,
  notifyGenerationTaskSucceeded,
  buildSucceededImageGenerationResult,
  resolveTaskNode,
  resolveSharedImageTaskNodes,
  bindGenerationTaskId,
  readGenerationResultIndex,
  pollGenerationTask,
  resolveGenerationResultPreview,
  updateGenerationTaskNodeTitleByTaskId,
} from './generationTaskState'

let followOwnerSeq = 0

export function scheduleGenerationTaskFollow(taskId: string, follow: () => Promise<unknown>) {
  const key = taskId.trim()
  if (!key || activePollingTaskOwners.has(key)) return false

  const owner = `follow-${Date.now()}-${++followOwnerSeq}`
  const epoch = generationPollEpoch
  activePollingTaskOwners.set(key, owner)
  void Promise.resolve()
    .then(async () => {
      if (epoch !== generationPollEpoch) return
      if (activePollingTaskOwners.get(key) !== owner) return
      await follow()
    })
    .finally(() => {
      // 仅清除自己登记的 key，避免旧轮询 finally 删掉同 taskId 的新轮询
      if (activePollingTaskOwners.get(key) === owner) {
        activePollingTaskOwners.delete(key)
      }
    })
  return true
}

export function startVideoGenerationTaskFollow(
  node: Node,
  taskId: string,
  options: {
    title?: string
    fileName?: string
    onError?: (message: string) => void
    onComplete?: (success: boolean) => void
  } = {},
) {
  const { onComplete, ...followOptions } = options
  scheduleGenerationTaskFollow(taskId, () =>
    followVideoGenerationTaskOnNode(node, taskId, followOptions).then((success) => {
      if (!success) notifyGenerationTaskSettled()
      onComplete?.(success)
      return success
    }),
  )
}

export function startTextGenerationTaskFollow(
  node: Node,
  taskId: string,
  options: {
    title?: string
    toHtml?: (text: string) => string
    onError?: (message: string) => void
    onComplete?: (success: boolean) => void
  } = {},
) {
  const { onComplete, ...followOptions } = options
  scheduleGenerationTaskFollow(taskId, () =>
    followTextGenerationTaskOnNode(node, taskId, followOptions).then((success) => {
      if (!success) notifyGenerationTaskSettled()
      onComplete?.(success)
      return success
    }),
  )
}

export function startImageGenerationTaskFollow(
  node: Node,
  taskId: string,
  options: {
    title: string
    fileName: string
    onError?: (message: string) => void
    onTaskBound?: (taskId: string) => void
    onComplete?: (result: ImageGenerationOnNodeResult) => void
    initialTask?: GenerationTaskDetail
  },
) {
  options.onTaskBound?.(taskId)
  scheduleGenerationTaskFollow(taskId, () =>
    pollAndApplyImageTaskOnNode(node, taskId, options).then((result) => {
      if (!result.success) notifyGenerationTaskSettled()
      options.onComplete?.(result)
      return result
    }),
  )
}

async function applyResolvedImageResultToNode(
  node: Node,
  raw: GenerationTaskResult | null,
  options: { title: string; fileName: string },
): Promise<boolean> {
  if (!raw || !isNodeOnGraph(node)) return false
  const resolved = await resolveGenerationResultPreview(raw)
  if (!resolved?.previewUrl?.trim()) return false
  return await applyGenerationResultToNode(node, resolved, options)
}

function isImageResultApplied(node: Node) {
  const data = node.getData() as CanvasNodeData
  return Boolean(data.previewUrl?.trim()) && data.imageGenState !== 'loading'
}

function isTextResultApplied(node: Node) {
  const data = node.getData() as CanvasNodeData
  return data.textGenState === 'done' && Boolean(String(data.content || '').trim())
}

export async function pollAndApplyImageTaskOnNode(
  node: Node,
  taskId: string,
  options: {
    title: string
    fileName: string
    onError?: (message: string) => void
    initialTask?: GenerationTaskDetail
    onTaskBound?: (taskId: string) => void
    /** 主节点进度更新时回调（整组共享 taskId 时可同步兄弟节点） */
    onProgress?: (progress: number, task: GenerationTaskDetail) => void
  },
): Promise<ImageGenerationOnNodeResult> {
  const graph = getNodeGraph(node)
  const resolveMembers = () => resolveSharedImageTaskNodes(graph, node, taskId)
  const resolvePrimary = () => resolveMembers()[0] ?? resolveTaskNode(graph, node, taskId)
  const current = resolvePrimary()
  if (!current) return { success: false }

  bindGenerationTaskId(
    current,
    taskId,
    'IMAGE',
    readGenerationResultIndex(current.getData() as CanvasNodeData),
  )
  options.onTaskBound?.(taskId)

  let appliedDuringPoll = false
  let resolvingResult = false

  const buildApplyOptions = (task: GenerationTaskDetail | undefined, target: Node) => {
    const nodeData = target.getData() as CanvasNodeData
    const taskName = pickGenerationTaskName(task)
    if (taskName && graph) {
      updateGenerationTaskNodeTitleByTaskId(graph, taskId, taskName)
    }
    const title = resolveGenerationResultTitle(
      taskName,
      options.title,
      nodeData.generationTaskName,
      nodeData.title,
    )
    return {
      title,
      fileName: nodeData.fileName || options.fileName || `${title}.png`,
    }
  }

  /** 按 generationResultIndex 把 results 写回同 taskId 的全部节点 */
  const applySharedResults = async (
    task: GenerationTaskDetail,
  ): Promise<{
    anyApplied: boolean
    allSettled: boolean
  }> => {
    const members = resolveMembers()
    if (!members.length) return { anyApplied: false, allSettled: false }

    const results = pickImageGenerationResults(task)
    let anyApplied = false
    let allSettled = true

    for (const member of members) {
      if (isImageResultApplied(member)) {
        anyApplied = true
        continue
      }

      const resultIndex = readGenerationResultIndex(member.getData() as CanvasNodeData)
      const raw = results[resultIndex] ?? null
      if (!raw) {
        if (isGenerationTaskTerminal(task.status) && task.status === 'SUCCEEDED') {
          markGenerationNodeFailed(member, '未返回对应结果图片')
        } else {
          allSettled = false
        }
        continue
      }

      const applyOptions = buildApplyOptions(task, member)
      const applied = await applyResolvedImageResultToNode(member, raw, applyOptions)
      if (applied) {
        anyApplied = true
        bindGenerationTaskId(member, taskId, 'IMAGE', resultIndex)
      } else if (isGenerationTaskTerminal(task.status) && task.status === 'SUCCEEDED') {
        markGenerationNodeFailed(member, '未返回对应结果图片')
      } else {
        allSettled = false
      }
    }

    return { anyApplied, allSettled }
  }

  const tryApplyDuringPoll = (task: GenerationTaskDetail) => {
    if (appliedDuringPoll || resolvingResult || !isGenerationTaskTerminal(task.status)) return
    if (!resolveMembers().length) return

    resolvingResult = true
    void applySharedResults(task)
      .then(({ anyApplied, allSettled }) => {
        if (anyApplied && allSettled) appliedDuringPoll = true
      })
      .finally(() => {
        resolvingResult = false
      })
  }

  const buildSuccessResult = (task: GenerationTaskDetail): ImageGenerationOnNodeResult =>
    buildSucceededImageGenerationResult(task)

  try {
    const first =
      options.initialTask ??
      normalizeGenerationTaskDetail(await getGenerationTaskDetail<GenerationTaskDetail>(taskId))

    const initialMembers = resolveMembers()
    if (!initialMembers.length) {
      return appliedDuringPoll ? buildSuccessResult(first) : { success: false }
    }

    if (initialMembers.every((member) => isImageResultApplied(member))) {
      return buildSuccessResult(first)
    }

    const progressTarget = initialMembers[0]
    updateGenerationNodeProgress(progressTarget, first.progress ?? 5)
    options.onProgress?.(first.progress ?? 5, first)
    if (graph) {
      const taskName = pickGenerationTaskName(first)
      if (taskName) updateGenerationTaskNodeTitleByTaskId(graph, taskId, taskName)
    }
    tryApplyDuringPoll(first)

    const finalTask = isGenerationTaskTerminal(first.status)
      ? first
      : await pollGenerationTask(taskId, {
          shouldContinue: () => resolveMembers().some((member) => !isImageResultApplied(member)),
          onProgress: (task) => {
            const members = resolveMembers()
            if (!members.length) return
            if (members.every((member) => isImageResultApplied(member))) return
            if (graph) {
              const taskName = pickGenerationTaskName(task)
              if (taskName) updateGenerationTaskNodeTitleByTaskId(graph, taskId, taskName)
            }
            if (isGenerationTaskTerminal(task.status)) {
              tryApplyDuringPoll(task)
              return
            }

            const target = members.find((member) => {
              const data = member.getData() as CanvasNodeData
              return data.imageGenState === 'loading'
            })
            if (!target) return

            updateGenerationNodeProgress(target, task.progress ?? 0)
            options.onProgress?.(task.progress ?? 0, task)
            tryApplyDuringPoll(task)
          },
        })

    const finalMembers = resolveMembers()
    if (!finalMembers.length) {
      return appliedDuringPoll ? buildSuccessResult(finalTask) : { success: false }
    }

    while (resolvingResult) {
      await new Promise((resolve) => window.setTimeout(resolve, 40))
    }

    if (finalTask.status !== 'SUCCEEDED') {
      if (finalMembers.every((member) => isImageResultApplied(member))) {
        return buildSuccessResult(finalTask)
      }
      const reason = finalTask.error?.message || '生成任务失败'
      for (const member of finalMembers) {
        if (!isImageResultApplied(member)) {
          markGenerationNodeFailed(member, reason)
        }
      }
      options.onError?.(reason)
      return { success: false }
    }

    const { anyApplied, allSettled } = await applySharedResults(finalTask)
    if (!anyApplied && !finalMembers.some((member) => isImageResultApplied(member))) {
      markGenerationNodeFailed(finalMembers[0], '未返回结果图片')
      options.onError?.('生成完成，但未返回结果图片')
      return { success: false }
    }

    if (
      !allSettled &&
      !finalMembers.every(
        (member) =>
          isImageResultApplied(member) ||
          (member.getData() as CanvasNodeData).imageGenState === 'failed',
      )
    ) {
      // 仍有 loading：再扫一遍缺失结果并标失败
      for (const member of finalMembers) {
        if (isImageResultApplied(member)) continue
        if ((member.getData() as CanvasNodeData).imageGenState === 'failed') continue
        markGenerationNodeFailed(member, '未返回对应结果图片')
      }
    }

    return buildSuccessResult(finalTask)
  } catch (error) {
    const members = resolveMembers()
    const reason = error instanceof Error ? error.message : '生成任务失败'
    for (const member of members) {
      if (!isImageResultApplied(member)) {
        markGenerationNodeFailed(member, reason)
      }
    }
    options.onError?.(reason)
    return { success: false }
  }
}

/** 继续追踪已有 taskId 的图片生成任务 */
export function followImageGenerationTaskOnNode(
  node: Node,
  taskId: string,
  options: {
    title: string
    fileName: string
    onError?: (message: string) => void
    onTaskBound?: (taskId: string) => void
  },
) {
  return pollAndApplyImageTaskOnNode(node, taskId, options).then((result) => result.success)
}

/** 继续追踪已有 taskId 的文本生成任务 */
export async function followTextGenerationTaskOnNode(
  node: Node,
  taskId: string,
  options: {
    title?: string
    toHtml?: (text: string) => string
    onError?: (message: string) => void
  } = {},
): Promise<boolean> {
  const graph = getNodeGraph(node)
  const resolveNode = () => resolveTaskNode(graph, node, taskId)
  const current = resolveNode()
  if (!current) return false

  bindGenerationTaskId(current, taskId, 'TEXT')

  try {
    if (isTextResultApplied(current)) return true

    const first = normalizeGenerationTaskDetail(
      await getGenerationTaskDetail<GenerationTaskDetail>(taskId),
    )
    updateTextGenerationNodeProgress(current, first.progress ?? 5)

    const finalTask = isGenerationTaskTerminal(first.status)
      ? first
      : await pollGenerationTask(taskId, {
          shouldContinue: () => Boolean(resolveNode()),
          onProgress: (task) => {
            const target = resolveNode()
            if (target) updateTextGenerationNodeProgress(target, task.progress ?? 0)
          },
        })

    const finalTarget = resolveNode()
    if (!finalTarget) return false
    if (isTextResultApplied(finalTarget)) return true

    if (finalTask.status !== 'SUCCEEDED') {
      const reason = finalTask.error?.message || '文本生成任务失败'
      markTextGenerationNodeFailed(finalTarget, reason)
      options.onError?.(reason)
      notifyGenerationTaskSettled()
      return false
    }

    const result = pickTextGenerationResult(finalTask)
    const content = result?.content?.trim() || ''
    if (!content) {
      markTextGenerationNodeFailed(finalTarget, '未返回文本')
      options.onError?.('生成完成，但未返回文本内容')
      notifyGenerationTaskSettled()
      return false
    }

    applyTextGenerationResultToNode(finalTarget, content, {
      title: options.title,
      toHtml: options.toHtml,
    })
    notifyGenerationTaskSucceeded(finalTask)
    return true
  } catch (error) {
    const target = resolveNode()
    if (target && !isTextResultApplied(target)) {
      markTextGenerationNodeFailed(target)
    }
    options.onError?.(error instanceof Error ? error.message : '文本生成失败，请稍后重试')
    notifyGenerationTaskSettled()
    return false
  }
}

/** 继续追踪已有 taskId 的 3D 生成任务 */
export async function followModelGenerationTaskOnNode(
  node: Node,
  taskId: string,
  options: {
    title?: string
    onError?: (message: string) => void
  } = {},
): Promise<boolean> {
  const graph = getNodeGraph(node)
  const resolveNode = () => resolveTaskNode(graph, node, taskId)
  const current = resolveNode()
  if (!current) return false

  bindGenerationTaskId(current, taskId, 'MODEL')

  try {
    const currentData = current.getData() as CanvasNodeData
    if (currentData.previewUrl && currentData.imageGenState !== 'loading') return true

    const first = normalizeGenerationTaskDetail(
      await getGenerationTaskDetail<GenerationTaskDetail>(taskId),
    )
    updateGenerationNodeProgress(current, first.progress ?? 5)

    const finalTask = isGenerationTaskTerminal(first.status)
      ? first
      : await pollGenerationTask(taskId, {
          shouldContinue: () => Boolean(resolveNode()),
          onProgress: (task) => {
            const target = resolveNode()
            if (target) updateGenerationNodeProgress(target, task.progress ?? 0)
          },
        })

    const finalTarget = resolveNode()
    if (!finalTarget) return false
    const finalData = finalTarget.getData() as CanvasNodeData
    if (finalData.previewUrl && finalData.imageGenState !== 'loading') {
      return true
    }

    if (finalTask.status !== 'SUCCEEDED') {
      const reason = finalTask.error?.message || '3D 生成任务失败'
      markGenerationNodeFailed(finalTarget, reason)
      options.onError?.(reason)
      notifyGenerationTaskSettled()
      return false
    }

    const result = pickModelGenerationResult(finalTask)
    const resolved = result ? await resolveGenerationResultPreview(result) : null
    if (!resolved?.previewUrl) {
      markGenerationNodeFailed(finalTarget, '未返回 3D 模型')
      options.onError?.('生成完成，但未返回 GLB 模型')
      notifyGenerationTaskSettled()
      return false
    }

    applyModelGenerationResultToNode(finalTarget, resolved, {
      title: options.title,
      fileName:
        resolved.previewUrl.split('/').pop()?.split('?')[0] || `${options.title || '3D 模型'}.glb`,
    })
    notifyGenerationTaskSucceeded(finalTask)
    return true
  } catch (error) {
    const target = resolveNode()
    if (target) markGenerationNodeFailed(target)
    options.onError?.(error instanceof Error ? error.message : '3D 生成失败，请稍后重试')
    notifyGenerationTaskSettled()
    return false
  }
}

/** 继续追踪已有 taskId 的视频生成任务 */
export async function followVideoGenerationTaskOnNode(
  node: Node,
  taskId: string,
  options: {
    title?: string
    fileName?: string
    onError?: (message: string) => void
  } = {},
): Promise<boolean> {
  const graph = getNodeGraph(node)
  const resolveNode = () => resolveTaskNode(graph, node, taskId)
  const current = resolveNode()
  if (!current) return false

  bindGenerationTaskId(current, taskId, 'VIDEO')

  try {
    const currentData = current.getData() as CanvasNodeData
    if (currentData.previewUrl && currentData.uploadState !== 'uploading') return true

    const first = normalizeGenerationTaskDetail(
      await getGenerationTaskDetail<GenerationTaskDetail>(taskId),
    )
    updateVideoGenerationNodeProgress(current, first.progress ?? 5)

    const finalTask = isGenerationTaskTerminal(first.status)
      ? first
      : await pollGenerationTask(taskId, {
          shouldContinue: () => Boolean(resolveNode()),
          onProgress: (task) => {
            const target = resolveNode()
            if (target) updateVideoGenerationNodeProgress(target, task.progress ?? 0)
          },
        })

    const finalTarget = resolveNode()
    if (!finalTarget) return false
    const finalData = finalTarget.getData() as CanvasNodeData
    if (finalData.previewUrl && finalData.uploadState !== 'uploading') {
      return true
    }

    if (finalTask.status !== 'SUCCEEDED') {
      const reason = finalTask.error?.message || '视频生成任务失败'
      markVideoGenerationNodeFailed(finalTarget, reason)
      options.onError?.(reason)
      return false
    }

    const result = pickVideoGenerationResult(finalTask)
    const resolved = result ? await resolveGenerationResultPreview(result) : null
    if (!resolved?.previewUrl) {
      markVideoGenerationNodeFailed(finalTarget, '未返回视频')
      options.onError?.('生成完成，但未返回视频')
      return false
    }

    await applyVideoGenerationResultToNode(finalTarget, resolved, {
      title: options.title,
      fileName: options.fileName || resolved.fileName || '文生视频.mp4',
    })
    notifyGenerationTaskSucceeded(finalTask)
    return true
  } catch (error) {
    const target = resolveNode()
    if (target) markVideoGenerationNodeFailed(target)
    options.onError?.(error instanceof Error ? error.message : '视频生成失败，请稍后重试')
    return false
  }
}
