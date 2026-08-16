import { onBeforeUnmount, ref } from 'vue'
import { createSSEParser } from './sseParser.ts'

type SSEOptions = {
  url: string
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  onMessage?: (data: string, event?: string) => void
  onOpen?: () => void
  onError?: (error: unknown) => void
  onDone?: () => void
}

export function useSSE() {
  const loading = ref(false)
  const connected = ref(false)
  const error = ref<unknown>(null)

  let abortController: AbortController | null = null

  const finishConnection = (controller: AbortController) => {
    // 旧连接异步结束时只能清理自己，不能覆盖后创建连接的状态
    if (abortController !== controller) return
    abortController = null
    loading.value = false
    connected.value = false
  }

  const close = () => {
    const controller = abortController
    abortController = null
    controller?.abort()
    loading.value = false
    connected.value = false
  }

  const connect = async (options: SSEOptions) => {
    close()

    loading.value = true
    connected.value = false
    error.value = null

    const controller = new AbortController()
    abortController = controller
    const signal = controller.signal

    try {
      const method = options.method ?? 'GET'
      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
        ...options.headers,
      }

      if (method === 'POST') {
        headers['Content-Type'] = 'application/json'
      }

      const init: RequestInit = {
        method,
        headers,
        signal,
      }

      if (method === 'POST' && options.body !== undefined) {
        init.body = JSON.stringify(options.body)
      }

      const response = await fetch(options.url, init)

      if (abortController !== controller) {
        await response.body?.cancel().catch(() => {})
        return
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message =
          typeof payload === 'object' && payload !== null && 'message' in payload
            ? String((payload as { message?: string }).message)
            : `SSE 请求失败 (${response.status})`
        throw new Error(message)
      }

      loading.value = false
      connected.value = true
      options.onOpen?.()

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('响应体不可读')
      }

      const decoder = new TextDecoder()
      const parser = createSSEParser(({ data, event }) => {
        if (abortController !== controller) return false
        if (data === '[DONE]') {
          options.onDone?.()
          finishConnection(controller)
          return false
        }
        options.onMessage?.(data, event)
        return true
      })

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!parser.push(decoder.decode(value, { stream: true }))) {
          await reader.cancel().catch(() => {})
          return
        }
      }

      parser.finish(decoder.decode())
      if (abortController === controller) {
        options.onDone?.()
        finishConnection(controller)
      }
    } catch (err) {
      if (signal.aborted) {
        finishConnection(controller)
        return
      }

      if (abortController !== controller) return
      loading.value = false
      connected.value = false
      error.value = err
      options.onError?.(err)
      finishConnection(controller)
    }
  }

  onBeforeUnmount(() => {
    close()
  })

  return {
    loading,
    connected,
    error,
    connect,
    close,
  }
}
