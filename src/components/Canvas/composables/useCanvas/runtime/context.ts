/**
 * 职责：定义画布核心运行时共享上下文。
 * 依赖：由组合根注入 bind、ports 与响应式状态。
 * 副作用：无；上下文属性由各域安装器按顺序填充。
 *
 * 公开契约以 CanvasBindings / CanvasCorePorts 为准。
 * 动态挂载字段仍用 any 袋兼容历史闭包；已去 nocheck 的域文件需自行注解回调参数。
 * quality-gate 锁定 runtime 目录 nocheck 数量只减不增。
 *
 * 跨域高频契约见 CoreRuntimeSharedFns（保存 / 切项目 / 工具栏 / 裁剪上传）。
 * 逐步去 nocheck 时优先按该清单为调用点补注解；勿把可选方法直接并入
 * CoreRuntimeContext，否则会把已存在的任意袋调用收成「可能 undefined」。
 */
import type { Node } from '@antv/x6'
import type { CanvasCorePorts } from '../corePorts'
import type { CanvasBindings } from '../types'

/** 跨域已收敛的运行时方法清单（文档 + 渐进收紧用，不直接并入 Context） */
export type CoreRuntimeSharedFns = {
  beginProjectCanvasSwitch: () => void
  getCanvasBoundProjectId: () => string
  scheduleHistoryPush: () => void
  updateNodeToolbar: () => void
  hasUnsavedChanges: () => boolean
  handleSaveCanvas: (saveType?: 'MANUAL' | 'AUTO') => void
  saveCanvasAndWait: (saveType?: 'MANUAL' | 'AUTO') => Promise<boolean>
  getSelectedNodeData: () => { previewUrl?: string; fileName?: string } | null | undefined
  focusErasedResultNode: (graph: unknown, node: Node) => void
  uploadLocalImageNodeInBackground: (
    node: Node,
    localPreviewUrl: string,
    fileName: string,
    payload: { dataUrl: string; width: number; height: number },
  ) => Promise<unknown>
  ensureImageEditorReady: (actionLabel: string) => Promise<boolean>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CoreRuntimeContext = CanvasBindings &
  Record<string, any> & {
    bind: CanvasBindings
    ports: CanvasCorePorts
  }
