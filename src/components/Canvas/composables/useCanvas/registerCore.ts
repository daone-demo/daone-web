/**
 * registerCore.ts
 * 职责：创建跨域端口，获取单例核心运行时并返回公开 API。
 * 依赖：corePorts、registerSupport；业务实现位于 runtime/install*（经 register* 再导出）。
 *
 * 装配顺序（在 createCoreRuntime 内执行）：
 * persistenceState / historyState →
 * derived → media → prompt → dialogue → marking →
 * persistence → connections（含 selection overlays）→
 * assets → historyClipboard → groups → lifecycle
 */
import type { CanvasBindings } from './types'
import { createEmptyPorts } from './corePorts'
import { getCoreRuntime } from './registerSupport'

export function registerCore(bind: CanvasBindings) {
  const ports = createEmptyPorts()
  // 各域 install* 在 createCoreRuntime 内按序写入 ctx；此处只取单例结果
  return getCoreRuntime(bind, ports)
}
