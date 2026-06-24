import { onBeforeUnmount, ref } from 'vue'

type SSEOptions = {
  url: string
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  onMessage?: (data: string) => void
  onOpen?: () => void
  onError?: (error: unknown) => void
  onDone?: () => void
}

export function useSSE() {
  const loading = ref(false)
  const connected = ref(false)
  const error = ref<unknown>(null)

  let abortController: AbortController | null = null

  const close = () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }

    loading.value = false
    connected.value = false
  }

  const connect = async (options: SSEOptions) => {
    close()

    loading.value = true
    connected.value = false
    error.value = null

    abortController = new AbortController()
    const signal = abortController.signal

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
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) continue

          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') {
            options.onDone?.()
            close()
            return
          }

          options.onMessage?.(data)
        }
      }

      options.onDone?.()
      close()
    } catch (err) {
      if (signal.aborted) {
        close()
        return
      }

      loading.value = false
      connected.value = false
      error.value = err
      options.onError?.(err)
      close()
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
