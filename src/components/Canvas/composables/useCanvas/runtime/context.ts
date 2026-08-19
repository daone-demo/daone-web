/**
 * 职责：定义画布核心运行时共享上下文。
 * 依赖：由组合根注入 bind、ports 与响应式状态。
 * 副作用：无；上下文属性由各域安装器按顺序填充。
 *
 * 公开契约以 CanvasBindings / CanvasCorePorts 为准。
 * 领域切片组合进 CoreRuntimeSharedFns，再与 CanvasBindings 及动态袋合成 CoreRuntimeContext。
 * 动态挂载字段仍用 Record 兼容历史闭包；已声明的共享方法按真实函数类型收紧。
 * quality-gate 锁定 runtime 目录不得再增加 @ts-nocheck（当前基线为 0）。
 */
import type { Graph, Node } from '@antv/x6'
import type { CanvasSnapshot } from '../../../canvasSnapshot'
import type {
  CanvasNodeData,
  ImageSourceRef,
  ImageToolbarClickEvent,
  VideoToolbarClickEvent,
} from '../../../constants'
import type { GenerationTaskResult } from '../../../generationTaskTypes'
import type { ResultPlacement } from '../../../imageGen'
import type { CanvasCorePorts } from '../corePorts'
import type { CanvasBindings } from '../types'

/** 持久化 / 切项目 */
export type CoreRuntimePersistenceFns = {
  beginProjectCanvasSwitch: () => void
  getCanvasBoundProjectId: () => string
  hasUnsavedChanges: () => boolean
  handleSaveCanvas: (saveType?: 'MANUAL' | 'AUTO') => void
  saveCanvasAndWait: (saveType?: 'MANUAL' | 'AUTO') => Promise<boolean>
  flushRemoteCanvasSave: (
    saveType: 'MANUAL' | 'AUTO',
    reusedSnapshot?: CanvasSnapshot | null,
  ) => Promise<boolean>
}

export type NodeToolbarUpdateOptions = {
  skipImageResizeOverlay?: boolean
  skipDialoguePos?: boolean
}

/** 历史与工具栏 */
export type CoreRuntimeToolbarFns = {
  scheduleHistoryPush: (options?: { autoSave?: boolean }) => void
  updateNodeToolbar: (options?: NodeToolbarUpdateOptions) => void
  getSelectedNodeData: () => CanvasNodeData | null | undefined
  getActiveSelectedNodeIds: () => string[]
}

/** 图片编辑 / 本地上传等跨域媒体操作 */
export type CoreRuntimeMediaOpsFns = {
  focusErasedResultNode: (graph: Graph, node: Node) => void
  uploadLocalImageNodeInBackground: (
    node: Node,
    localPreviewUrl: string,
    fileName: string,
    payload: {
      dataUrl?: string
      width: number
      height: number
      preserveTitle?: boolean
      silent?: boolean
    },
  ) => Promise<unknown>
  ensureImageEditorReady: (
    actionLabel: string,
    loadingText?: string,
  ) => Promise<CanvasNodeData | null>
}

/** 对话参考图 / 溯源 */
export type CoreRuntimeDialogueRefFns = {
  enrichImageSourceRefPreview: (item: ImageSourceRef) => ImageSourceRef
  isDigitalHumanDialogueRef: (item: ImageSourceRef) => boolean
  buildNodeSelfDialogueRef: (data: CanvasNodeData, nodeId: string) => ImageSourceRef | null
  resolveImageDialogueRefs: (data: CanvasNodeData, targetNodeId: string) => ImageSourceRef[]
  seedImageDialogueRefs: (data: CanvasNodeData, targetNodeId: string) => ImageSourceRef[]
  getImageDialoguePreviewsForNode: (nodeId: string) => ImageSourceRef[]
  linkImageNodeToImageDialogue: (imageNodeId: string, targetNodeId?: string) => Promise<boolean>
}

export type ImageGenerationTaskConfig = {
  capabilityCode: string
  title: string
  prompt?: string
  workflowId?: string | number | null
  requireAssetId?: boolean
  requireSourcePreview?: boolean
  resultPlacement?: ResultPlacement
  buildFileName: (sourceFileName: string) => string
  buildParameters: (event: ImageToolbarClickEvent) => Record<string, unknown>
  resolveReferenceAssetIds?: (event: ImageToolbarClickEvent) => string[]
}

export type VideoGenerationTaskConfig = {
  capabilityCode: string
  title: string
  prompt?: string
  requireAssetId?: boolean
  requireSourcePreview?: boolean
  buildFileName: (sourceFileName: string) => string
  buildParameters: (event: VideoToolbarClickEvent) => Record<string, unknown>
  resolveReferenceAssetIds?: () => string[]
}

export type ExtraGenerationResultSpawnConfig = {
  title: string
  sourceFileName: string
  buildFileName: (sourceFileName: string) => string
  resultIndexOffset: number
  totalCount: number
  placement?: ResultPlacement
  snapshotSourceNode?: Node
}

/** 生成任务 / 连线落点 */
export type CoreRuntimeGenerationFns = {
  runImageGenerationTask: (
    event: ImageToolbarClickEvent,
    config: ImageGenerationTaskConfig,
  ) => Promise<void>
  runVideoGenerationTask: (
    event: VideoToolbarClickEvent,
    config: VideoGenerationTaskConfig,
  ) => Promise<void>
  spawnNodesForExtraGenerationResults: (
    g: Graph,
    sourceNode: Node,
    extraResults: GenerationTaskResult[],
    config: ExtraGenerationResultSpawnConfig,
  ) => Promise<Node[]>
  linkImageNodeToVideoGen: (imageNodeId: string) => Promise<boolean>
  addImageFromFile: (
    file: File,
    point?: { x: number; y: number },
    options?: { select?: boolean },
  ) => Promise<Node | null>
}

/** 跨域共享方法：按领域切片组合后并入 CoreRuntimeContext */
export type CoreRuntimeSharedFns = CoreRuntimePersistenceFns &
  CoreRuntimeToolbarFns &
  CoreRuntimeMediaOpsFns &
  CoreRuntimeDialogueRefFns &
  CoreRuntimeGenerationFns

/**
 * 运行时上下文：绑定态 + 领域共享方法 + 动态袋（尚未收紧的历史字段）。
 * 创建早期用断言填充；各 install* 按顺序写入真实实现。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CoreRuntimeContext = CanvasBindings &
  CoreRuntimeSharedFns &
  Record<string, any> & {
    bind: CanvasBindings
    ports: CanvasCorePorts
  }
