export const TEXT_EDITOR_PLACEHOLDER = '输入内容...'

export type TextFormatCommand =
  | 'clear'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'paragraph'
  | 'bold'
  | 'italic'
  | 'bullet'
  | 'ordered'
  | 'hr'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'expand'
  | 'color'
  | 'clear-color'
  | 'fontFamily'
  | 'fontWeight'
  | 'fontSize'
  | 'align'
  | 'lineHeight'
  | 'download'
  | 'delete'

export const TEXT_FORMAT_TOOLBAR: Array<{
  key: TextFormatCommand
  label: string
  title: string
  dividerAfter?: boolean
}> = [
  { key: 'clear', label: '⊘', title: '清除格式' },
  { key: 'h1', label: 'H1', title: '一级标题' },
  { key: 'h2', label: 'H2', title: '二级标题' },
  { key: 'h3', label: 'H3', title: '三级标题' },
  { key: 'paragraph', label: '¶', title: '正文', dividerAfter: true },
  { key: 'bold', label: 'B', title: '加粗' },
  { key: 'italic', label: 'I', title: '斜体', dividerAfter: true },
  { key: 'bullet', label: '≡', title: '无序列表' },
  { key: 'ordered', label: '1.', title: '有序列表' },
  { key: 'hr', label: '—', title: '分割线', dividerAfter: true },
  { key: 'copy', label: '⎘', title: '复制' },
  { key: 'expand', label: '⤢', title: '全屏编辑' },
]

/** 文本属性工具栏：色板 */
export const TEXT_COLOR_SWATCHES = [
  '#111111',
  '#6b7280',
  '#ffffff',
  '#ef4444',
  '#f59e0b',
  '#fbbf24',
  '#10b981',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#0ea5e9',
]

/** 文本属性工具栏：字体 */
export const TEXT_FONT_FAMILIES: Array<{ label: string; value: string }> = [
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: '苹方', value: '"PingFang SC", system-ui, sans-serif' },
  { label: '思源黑体', value: '"Source Han Sans SC", system-ui, sans-serif' },
  { label: '宋体', value: 'SimSun, serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: '等宽', value: '"JetBrains Mono", Menlo, monospace' },
]

/** 文本属性工具栏：字重 */
export const TEXT_FONT_WEIGHTS: Array<{ label: string; value: string }> = [
  { label: 'Light', value: '300' },
  { label: 'Regular', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semibold', value: '600' },
  { label: 'Bold', value: '700' },
]

/** 文本属性工具栏：字号 (px) */
export const TEXT_FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96]

/** 文本属性工具栏：对齐 */
export const TEXT_ALIGN_OPTIONS: Array<{ key: string; label: string; title: string }> = [
  { key: 'left', label: '⬅', title: '左对齐' },
  { key: 'center', label: '⬌', title: '居中对齐' },
  { key: 'right', label: '➡', title: '右对齐' },
  { key: 'justify', label: '☰', title: '两端对齐' },
]

/** 文本属性工具栏：行距 */
export const TEXT_LINE_HEIGHTS = ['1', '1.25', '1.5', '1.75', '2']
