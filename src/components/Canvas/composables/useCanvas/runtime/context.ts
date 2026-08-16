/**
 * 职责：定义画布核心运行时共享上下文。
 * 依赖：由组合根注入 bind、ports 与响应式状态。
 * 副作用：无；上下文属性由各域安装器按顺序填充。
 *
 * 公开契约以 CanvasBindings / CanvasCorePorts 为准。
 * 动态挂载字段仍用 any 袋兼容历史闭包；已去 nocheck 的域文件需自行注解回调参数。
 * quality-gate 锁定 runtime 目录 nocheck 数量只减不增。
 */
import type { CanvasCorePorts } from '../corePorts'
import type { CanvasBindings } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CoreRuntimeContext = CanvasBindings &
  Record<string, any> & {
    bind: CanvasBindings
    ports: CanvasCorePorts
  }
