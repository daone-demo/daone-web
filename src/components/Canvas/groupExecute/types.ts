import type { ImageDialogueSettings, ImageSourceRef } from '../constants'

export type GroupAiTaskKind =
  | 'imageCapability'
  | 'imageDialogue'
  | 'textImg2Prompt'
  | 'textCopy'
  | 'text2image'
  | 'text2video'
  | 'videoDialogue'

export interface GroupAiTask {
  nodeId: string
  kind: GroupAiTaskKind
  capabilityCode: string
  creditCost: number
  dependsOn: string[]
  /**
   * 与本节点共享同一 generationTaskId 的兄弟节点 id。
   * 整组执行时只创建一次任务，再按 generationResultIndex 分发 results。
   */
  sharedResultNodeIds?: string[]
}

export interface GroupAiReferenceContext {
  referenceAssetIds: string[]
  sourceRefs: ImageSourceRef[]
  prompt: string
  parameters: Record<string, unknown>
  settings?: ImageDialogueSettings
  workflowId?: string | number | null
  taskTitle: string
  capabilityCode: string
}
