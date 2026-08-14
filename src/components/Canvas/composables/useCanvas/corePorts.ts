/**
 * corePorts.ts
 * 跨 register* 模块的端口契约。
 *
 * 设计目的：
 * - registerCore 原是单一闭包，函数可互相自由调用（依赖提升）。
 * - 拆成多文件后禁止模块顶层互相 import，否则会产生循环依赖。
 * - 由 registerCore 装配空端口对象，各模块把自身 API 写入端口；
 *   跨域调用时通过 `ports.xxx.fn()` **在调用时**读取，勿提前解构。
 *
 * 装配顺序见 registerCore.ts 顶部注释。
 */

import type { Node } from '@antv/x6'
import type { CanvasBindings } from './types'

/** 选择 / 工具栏 / 浮层定位端口 */
export type SelectionPort = {
  selectGraphNodes: (...targets: Array<Node | string>) => void
  syncSelectionFromGraph: () => void
  syncNodeSelectionHighlight: (ids?: string | string[]) => void
  updateNodeToolbar: (options?: {
    skipImageResizeOverlay?: boolean
    skipDialoguePos?: boolean
  }) => void
  bumpToolbarRevision: () => void
}

/** 历史栈 / 自动保存触发端口 */
export type HistoryPort = {
  scheduleHistoryPush: (options?: { autoSave?: boolean }) => void
  syncHistoryState: () => void
}

/** 对话字段持久化 / 关闭端口（保存快照前置依赖） */
export type DialoguePort = {
  persistImageDialogueFields: (nodeId?: string) => void
  persistVideoDialogueFields: (nodeId?: string) => void
  closeImageDialoguePanels: () => void
}

/** 图/视频生成执行端口（分组整组执行等通过此端口调用，避免直接 import） */
export type GenerationPort = {
  runImageGenerationTask: (...args: unknown[]) => Promise<void>
  runVideoGenerationTask: (...args: unknown[]) => Promise<void>
}

/**
 * 组合根持有的全部端口。
 * 字段在对应 register* 执行后被填充；调用方必须惰性访问。
 */
export type CanvasCorePorts = {
  selection: Partial<SelectionPort>
  history: Partial<HistoryPort>
  dialogue: Partial<DialoguePort>
  generation: Partial<GenerationPort>
}

/** 创建空端口对象，供 registerCore 按序装配 */
export function createEmptyPorts(): CanvasCorePorts {
  return {
    selection: {},
    history: {},
    dialogue: {},
    generation: {},
  }
}

/**
 * 各 register* 模块的统一入参约定。
 * bind：共享响应式状态与已合并的 API（后注册模块可读先注册结果）。
 * ports：跨域惰性调用通道。
 */
export type RegisterModuleInput = {
  bind: CanvasBindings
  ports: CanvasCorePorts
}
