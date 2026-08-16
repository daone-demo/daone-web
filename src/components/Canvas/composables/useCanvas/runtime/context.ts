/**
 * 职责：定义画布核心运行时共享上下文。
 * 依赖：由组合根注入 bind、ports 与响应式状态。
 * 副作用：无；上下文属性由各域安装器按顺序填充。
 */
import type { CanvasCorePorts } from '../corePorts'
import type { CanvasBindings } from '../types'

/**
 * 域安装器挂载的动态方法/状态。
 * 使用显式 any 袋保持与历史闭包一致的可写性；公开契约仍以 CanvasBindings 为准。
 * 编排入口（install*）已去掉 nocheck；子域文件基线由 quality-gate 约束只减不增。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CoreRuntimeContext = CanvasBindings &
  Record<string, any> & {
    bind: CanvasBindings
    ports: CanvasCorePorts
  }
