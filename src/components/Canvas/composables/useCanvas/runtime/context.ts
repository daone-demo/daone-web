/**
 * 职责：定义画布核心运行时共享上下文。
 * 依赖：由组合根注入 bind、ports 与响应式状态。
 * 副作用：无；上下文属性由各域安装器按顺序填充。
 *
 * 公开契约以 CanvasBindings / CanvasCorePorts 为准。
 * 领域切片（Persistence / Toolbar / MediaOps）组合进 CoreRuntimeSharedFns，
 * 再与 CanvasBindings 及动态袋合成 CoreRuntimeContext。
 * 动态挂载字段仍用 Record 兼容历史闭包；已声明的共享方法按真实函数类型收紧。
 * quality-gate 锁定 runtime 目录 nocheck 数量只减不增。
 */
import type { Node } from '@antv/x6'
import type { CanvasCorePorts } from '../corePorts'
import type { CanvasBindings } from '../types'

/** 持久化 / 切项目 */
export type CoreRuntimePersistenceFns = {
  beginProjectCanvasSwitch: () => void
  getCanvasBoundProjectId: () => string
  hasUnsavedChanges: () => boolean
  handleSaveCanvas: (saveType?: 'MANUAL' | 'AUTO') => void
  saveCanvasAndWait: (saveType?: 'MANUAL' | 'AUTO') => Promise<boolean>
}

/** 历史与工具栏 */
export type CoreRuntimeToolbarFns = {
  scheduleHistoryPush: () => void
  updateNodeToolbar: () => void
  getSelectedNodeData: () => { previewUrl?: string; fileName?: string } | null | undefined
}

/** 图片编辑 / 本地上传等跨域媒体操作 */
export type CoreRuntimeMediaOpsFns = {
  focusErasedResultNode: (graph: unknown, node: Node) => void
  uploadLocalImageNodeInBackground: (
    node: Node,
    localPreviewUrl: string,
    fileName: string,
    payload: { dataUrl: string; width: number; height: number },
  ) => Promise<unknown>
  ensureImageEditorReady: (actionLabel: string) => Promise<boolean>
}

/** 跨域共享方法：按领域切片组合后并入 CoreRuntimeContext */
export type CoreRuntimeSharedFns = CoreRuntimePersistenceFns &
  CoreRuntimeToolbarFns &
  CoreRuntimeMediaOpsFns

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
