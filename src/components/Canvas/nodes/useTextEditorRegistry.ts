import type { TextFormatCommand } from '../constants'

export type TextEditorApi = {
  /** value 用于带参命令：颜色/字体/字重/字号/对齐/行距 */
  execFormat: (cmd: TextFormatCommand, value?: string) => void
  copyContent: () => Promise<void>
  requestExpand: () => void
  focus: () => void
  getPlainText: () => string
}

export type TextEditorRegistry = {
  register: (nodeId: string, api: TextEditorApi) => void
  unregister: (nodeId: string) => void
  get: (nodeId: string) => TextEditorApi | undefined
}
