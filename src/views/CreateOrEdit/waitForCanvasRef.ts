/**
 * CreateOrEdit 在 Canvas 异步分包后，需在组件挂载后再注入画布快照。
 * 调用方必须先结束 pageLoading（让 Canvas 进入 DOM），再 wait；
 * 切勿在 loading 屏期间阻塞等待，否则会与 v-if 形成死锁。
 */
export async function waitForCanvasRef<T>(
  getRef: () => T | null | undefined,
  options: { timeoutMs?: number; intervalMs?: number; nextTick?: () => Promise<void> } = {},
): Promise<T | null> {
  const timeoutMs = options.timeoutMs ?? 8_000
  const intervalMs = options.intervalMs ?? 16
  const tick = options.nextTick ?? (async () => undefined)

  const existing = getRef()
  if (existing) return existing

  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    await tick()
    const current = getRef()
    if (current) return current
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
  }
  return getRef() ?? null
}

export function flushPendingCanvasPayload<TPayload, TCanvas extends {
  loadProjectCanvas: (payload: TPayload) => unknown
}>(
  canvas: TCanvas | null | undefined,
  pending: TPayload | null | undefined,
): boolean {
  if (!canvas || pending == null) return false
  // 必须尊重 load 返回值：图未就绪时返回 false，调用方保留 pending 以便重试
  return Boolean(canvas.loadProjectCanvas(pending))
}
