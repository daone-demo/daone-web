/**
 * 职责：定义画布核心运行时共享上下文。
 * 依赖：由组合根注入 bind、ports 与响应式状态。
 * 副作用：无；上下文属性由各域安装器按顺序填充。
 */
import type { CanvasCorePorts } from '../corePorts'
import type { CanvasBindings } from '../types'

export type CoreRuntimeContext = CanvasBindings &
  Record<string, any> & {
    bind: CanvasBindings
    ports: CanvasCorePorts
  }
