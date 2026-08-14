/**
 * registerSupport.ts
 * 职责：缓存单个 bind 对应的核心运行时，保证共享上下文只创建一次。
 * 依赖：coreRuntime 组合根与 corePorts；不依赖任何 register* 模块。
 */

import type { CanvasBindings } from './types'
import type { CanvasCorePorts } from './corePorts'
import { createCoreRuntime } from './coreRuntime'

export type CoreRuntimeApi = ReturnType<typeof createCoreRuntime>

const runtimeByBindings = new WeakMap<object, CoreRuntimeApi>()

export function getCoreRuntime(bind: CanvasBindings, ports: CanvasCorePorts): CoreRuntimeApi {
  const cached = runtimeByBindings.get(bind)
  if (cached) return cached
  const runtime = createCoreRuntime(bind, ports)
  runtimeByBindings.set(bind, runtime)
  return runtime
}
