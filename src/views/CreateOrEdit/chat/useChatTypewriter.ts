import { ref } from 'vue'
import type { ChatMessage } from '../chatTypes'
import { setMessageTip } from './chatMarkdown'

export type TypewriterHandle = {
  cancel: () => void
  done: Promise<void>
}

export function useChatTypewriter(scrollMessagesToBottom: () => void) {
  const typewriterHandles = new Map<string, TypewriterHandle>()
  const streamingMessageIds = ref<Set<string>>(new Set())

  function cancelTypewriter(messageId: string) {
    const handle = typewriterHandles.get(messageId)
    if (!handle) return
    handle.cancel()
    typewriterHandles.delete(messageId)
    const next = new Set(streamingMessageIds.value)
    next.delete(messageId)
    streamingMessageIds.value = next
  }

  /** 将整段文本以打字机效果流式写入助手消息 */
  function streamAssistantText(
    assistant: ChatMessage,
    fullText: string,
    mode: 'replace' | 'append' = 'replace',
  ) {
    if (!fullText) return Promise.resolve()

    cancelTypewriter(assistant.id)

    let base = ''
    let target = fullText

    if (mode === 'append') {
      base = assistant.text
      if (fullText.startsWith(base)) {
        target = fullText
      } else {
        target = base + fullText
      }
    } else if (fullText === assistant.text) {
      setMessageTip(assistant, undefined)
      return Promise.resolve()
    } else if (fullText.startsWith(assistant.text) && assistant.text) {
      base = assistant.text
      target = fullText
    } else {
      assistant.text = ''
      base = ''
      target = fullText
    }

    setMessageTip(assistant, undefined)

    let cancelled = false
    let index = base.length
    streamingMessageIds.value = new Set(streamingMessageIds.value).add(assistant.id)

    const done = new Promise<void>((resolve) => {
      const step = () => {
        if (cancelled) {
          resolve()
          return
        }
        if (index >= target.length) {
          assistant.text = target
          typewriterHandles.delete(assistant.id)
          const next = new Set(streamingMessageIds.value)
          next.delete(assistant.id)
          streamingMessageIds.value = next
          scrollMessagesToBottom()
          resolve()
          return
        }
        const stride = target.length - index > 80 ? 3 : target.length - index > 30 ? 2 : 1
        index = Math.min(target.length, index + stride)
        assistant.text = target.slice(0, index)
        scrollMessagesToBottom()
        window.setTimeout(step, 16)
      }
      step()
    })

    typewriterHandles.set(assistant.id, {
      cancel: () => {
        cancelled = true
        assistant.text = target
      },
      done,
    })

    return done
  }

  function cancelAll() {
    typewriterHandles.forEach((handle) => handle.cancel())
    typewriterHandles.clear()
    streamingMessageIds.value = new Set()
  }

  function dispose() {
    cancelAll()
  }

  return {
    typewriterHandles,
    streamingMessageIds,
    cancelTypewriter,
    streamAssistantText,
    cancelAll,
    dispose,
  }
}
