export interface SSEEvent {
  data: string
  event?: string
}

export type SSEEventHandler = (event: SSEEvent) => boolean | void

/**
 * 增量解析 text/event-stream。
 * - 空行派发事件
 * - 同一事件的多个 data 字段以换行拼接
 * - 支持 LF、CRLF、CR 以及任意网络分块边界
 */
export function createSSEParser(onEvent: SSEEventHandler) {
  let buffer = ''
  let eventName = ''
  let dataLines: string[] = []
  let stopped = false

  function dispatchEvent() {
    if (!dataLines.length || stopped) {
      eventName = ''
      dataLines = []
      return !stopped
    }

    const shouldContinue = onEvent({
      data: dataLines.join('\n'),
      event: eventName || undefined,
    })
    eventName = ''
    dataLines = []
    if (shouldContinue === false) stopped = true
    return !stopped
  }

  function processLine(line: string) {
    if (line === '') return dispatchEvent()
    if (line.startsWith(':')) return true

    const colonIndex = line.indexOf(':')
    const field = colonIndex < 0 ? line : line.slice(0, colonIndex)
    let value = colonIndex < 0 ? '' : line.slice(colonIndex + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    if (field === 'event') {
      eventName = value
    } else if (field === 'data') {
      dataLines.push(value)
    }
    return true
  }

  function consumeCompleteLines(final = false) {
    let offset = 0

    while (offset < buffer.length && !stopped) {
      const lfIndex = buffer.indexOf('\n', offset)
      const crIndex = buffer.indexOf('\r', offset)
      let lineEnd = -1

      if (lfIndex >= 0 && crIndex >= 0) lineEnd = Math.min(lfIndex, crIndex)
      else lineEnd = Math.max(lfIndex, crIndex)

      if (lineEnd < 0) break
      // 分块刚好结束在 CR 时，等待下一块以正确吞掉可能的 LF。
      if (!final && buffer[lineEnd] === '\r' && lineEnd === buffer.length - 1) break

      const line = buffer.slice(offset, lineEnd)
      const isCrLf = buffer[lineEnd] === '\r' && buffer[lineEnd + 1] === '\n'
      offset = lineEnd + (isCrLf ? 2 : 1)
      if (!processLine(line)) break
    }

    buffer = buffer.slice(offset)
  }

  return {
    push(chunk: string) {
      if (stopped || !chunk) return !stopped
      buffer += chunk
      consumeCompleteLines()
      return !stopped
    },
    finish(tail = '') {
      if (stopped) return false
      buffer += tail
      consumeCompleteLines(true)
      if (buffer && !stopped) {
        processLine(buffer)
        buffer = ''
      }
      // 按客户端容错要求，EOF 也作为最后一个事件边界。
      if (!stopped) dispatchEvent()
      return !stopped
    },
  }
}
