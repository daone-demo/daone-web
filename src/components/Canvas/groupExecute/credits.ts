import type { GroupAiTask } from './types'

export function estimateGroupExecuteCredits(tasks: GroupAiTask[]): number {
  return tasks.reduce((sum, task) => sum + task.creditCost, 0)
}

export function buildGroupExecuteConfirmContent(taskCount: number, _credits: number) {
  if (taskCount <= 0) {
    return {
      main: '即将对组内 0 个生成节点依次执行，是否继续？',
      hint: '仅生成节点会被执行，特殊节点需手动执行。',
    }
  }

  return {
    // main: `即将对组内 ${taskCount} 个生成节点分批执行，预计消耗 ${credits} 积分，是否继续？`,
    main: `即将对组内 ${taskCount} 个生成节点分批执行`,
    hint: '无依赖的节点将并行执行；任一上游完成后，立即执行其下游节点。均在组内已有 AI 节点上原地重新生成，不会新建节点。',
  }
}
