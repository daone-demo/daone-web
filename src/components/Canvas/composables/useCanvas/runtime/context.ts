/**
 * 职责：定义画布核心运行时共享上下文。
 * 依赖：由组合根注入 bind、ports 与响应式状态。
 * 副作用：无；上下文属性由各域安装器按顺序填充。
 *
 * 公开契约以 CanvasBindings / CanvasCorePorts 为准。
 * 领域切片组合进 CoreRuntimeSharedFns，再与 CanvasBindings、安装状态和动态方法槽合成 CoreRuntimeContext。
 * 动态袋不再使用 any 索引签名；安装空壳通过 asCoreRuntimeContext 断言。
 * quality-gate 锁定 runtime 目录不得再增加文件级 nocheck，并扫描显式 any（当前基线为 0）。
 */
import type { Graph, Node } from '@antv/x6'
import type { Ref } from 'vue'
import type { ProjectCanvasResponse, ProjectVersionDetailResponse } from '@/services/api'
import type { createCanvasHistory } from '../../../canvasHistory'
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
import type { CoreRuntimeInstallSlots } from './installedSlots'

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
  waitForSaveSettled: (maxWaitMs?: number) => Promise<void>
  setCanvasDescription: (description: string, taskType?: string) => void
  buildCanvasSnapshot: () => CanvasSnapshot | null
  markLocalCanvasChange: () => void
  triggerAutoSaveIfReady: () => void
  loadProjectCanvas: (payload: ProjectCanvasResponse) => boolean
  loadProjectCanvasFromVersion: (detail: ProjectVersionDetailResponse) => boolean
}

export type CoreRuntimePendingSaveJob = {
  projectId: string
  snapshot: CanvasSnapshot
  type: 'MANUAL' | 'AUTO'
  changeEpoch: number
  resolve: (ok: boolean) => void
}

/** 安装器写入的持久化队列 / dirty 标记（非 bind 响应式字段） */
export type CoreRuntimePersistenceState = {
  autoSaveDebounceTimer: ReturnType<typeof setTimeout> | null
  autoSaveEnabled: boolean
  canvasContentReady: boolean
  canvasBoundProjectId: string
  saveInFlight: boolean
  pendingRemoteSaveType: 'MANUAL' | 'AUTO' | null
  pendingSaveJobs: CoreRuntimePendingSaveJob[]
  pendingProjectCanvas: ProjectCanvasResponse | null
  localDirty: boolean
  localChangeEpoch: number
}

/** 历史栈运行时句柄 */
export type CoreRuntimeHistoryState = {
  canvasHistory: ReturnType<typeof createCanvasHistory> | null
  historyPushTimer: ReturnType<typeof setTimeout> | null
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

/** 安装器写入、尚未进入 CanvasBindings 的派生 computed */
export type CoreRuntimeDerivedExtras = {
  showEdgeDeleteButton: import('vue').ComputedRef<boolean>
  imageGenSourceRefs: import('vue').ComputedRef<import('../../../videoGen').VideoSourceRef[]>
}

/** 安装器写入的非方法状态：ref / 定时器 / 商店 / 选中对话节点 id */
export type CoreRuntimeInstallData = {
  graphDropEl: HTMLElement | null
  scrollerScrollTarget: HTMLElement | null
  edgeHoverLeaveTimer: number
  imageMarkHintTimer: ReturnType<typeof setTimeout> | number | null
  videoToolbarDeferTimer: ReturnType<typeof setTimeout> | number | null
  videoToolbarClickDeferred: Ref<boolean>
  imageMarkCoordinateOnly: Ref<boolean>
  imageMarkRecognizing: Ref<boolean>
  selectedElementMarkId: Ref<string>
  altVoiceTimer: Ref<ReturnType<typeof setTimeout> | number | null>
  userInfoStore: ReturnType<typeof import('@stores/useUserInfo').useUserInfo>
  lastCanvasFileInputClickAt: number
  CANVAS_FILE_INPUT_CLICK_DEBOUNCE_MS: number
  groupOverlayDragCleanup: (() => void) | null
  toolbarUpdateRaf: number
  viewportVisibilityRaf: number
  pendingToolbarUpdateOptions: NodeToolbarUpdateOptions | undefined
  activeImageDialogueNodeId: string
  activeVideoDialogueNodeId: string
}

/** 跨域共享方法：按领域切片组合后并入 CoreRuntimeContext */
export type CoreRuntimeSharedFns = CoreRuntimePersistenceFns &
  CoreRuntimeToolbarFns &
  CoreRuntimeMediaOpsFns &
  CoreRuntimeDialogueRefFns &
  CoreRuntimeGenerationFns

/**
 * 运行时上下文：绑定态 + 领域共享方法 + 按域声明的安装状态 + 动态方法槽。
 * 创建早期用 asCoreRuntimeContext 填充空壳；各 install* 按顺序写入真实实现。
 * 动态袋不再使用 any 索引签名，未声明字段走 CanvasBindings 的 unknown 索引。
 */
export type CoreRuntimeContext = CanvasBindings &
  CoreRuntimeSharedFns &
  CoreRuntimePersistenceState &
  CoreRuntimeHistoryState &
  CoreRuntimeDerivedExtras &
  CoreRuntimeInstallData &
  CoreRuntimeInstallSlots & {
    bind: CanvasBindings
    ports: CanvasCorePorts
  }

/** 安装阶段明确断言：把 bind/ports 空壳收窄为完整运行时上下文 */
export function asCoreRuntimeContext(shell: {
  bind: CanvasBindings
  ports: CanvasCorePorts
}): CoreRuntimeContext {
  return shell as CoreRuntimeContext
}
