// src/hooks/useSSE.ts

import { ref, onBeforeUnmount } from 'vue'

type SSEOptions = {
  url: string
  query?: Record<string, any>
  headers?: Record<string, string>
  onMessage?: (data: string, event: MessageEvent) => void
  onOpen?: (event: Event) => void
  onError?: (event: Event) => void
  onDone?: () => void
}

export function useSSE() {
  const loading = ref(false)
  const connected = ref(false)
  const error = ref<any>(null)

  let eventSource: EventSource | null = null

  const buildUrl = (url: string, query?: Record<string, any>) => {
    if (!query) return url

    const params = new URLSearchParams()

    Object.keys(query).forEach(key => {
      const value = query[key]
      if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    })

    const queryString = params.toString()

    return queryString ? `${url}?${queryString}` : url
  }

  const connect = (options: SSEOptions) => {
    close()

    loading.value = true
    connected.value = false
    error.value = null

    const requestUrl = buildUrl(options.url, options.query)

    eventSource = new EventSource(requestUrl)

    eventSource.onopen = event => {
      loading.value = false
      connected.value = true
      options.onOpen?.(event)
    }

    eventSource.onmessage = event => {
      const data = event.data

      if (data === '[DONE]') {
        options.onDone?.()
        close()
        return
      }

      options.onMessage?.(data, event)
    }

    eventSource.onerror = event => {
      loading.value = false
      connected.value = false
      error.value = event

      options.onError?.(event)

      close()
    }
  }

  const close = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    loading.value = false
    connected.value = false
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