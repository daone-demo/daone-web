export type CanvasShortcutItem = {
  label: string
  keys?: string[]
  hint?: string
}

export type CanvasShortcutGroup = {
  title: string
  items: CanvasShortcutItem[]
}

/** 修饰键展示文案（与产品截图一致使用 Ctrl） */
export const SHORTCUT_MOD_KEY = 'Ctrl'

/** 快捷键说明面板：操作 / 编辑 / 视图 / 图层 */
export const CANVAS_SHORTCUT_GROUPS: CanvasShortcutGroup[] = [
  {
    title: '操作',
    items: [
      { label: '多选分组', keys: [SHORTCUT_MOD_KEY, '鼠标左键', '移动鼠标'] },
      { label: '多选图片', keys: [SHORTCUT_MOD_KEY, '鼠标左键', '点选图片'] },
      { label: '语音输入', keys: ['选中图片', '长按 Alt'] },
      { label: '取消 / 退出当前操作', keys: ['Escape'] },
    ],
  },
  {
    title: '编辑',
    items: [
      { label: '保存项目', keys: [SHORTCUT_MOD_KEY, 'S'] },
      { label: '复制', keys: [SHORTCUT_MOD_KEY, 'C'] },
      { label: '粘贴', keys: [SHORTCUT_MOD_KEY, 'V'] },
      { label: '撤销', keys: [SHORTCUT_MOD_KEY, 'Z'] },
      { label: '重做', keys: [SHORTCUT_MOD_KEY, 'Shift', 'Z'] },
      { label: '预览图片', keys: ['Space'] },
      { label: '删除选中元素', keys: ['Delete', '/', 'Backspace'] },
    ],
  },
  {
    title: '视图',
    items: [
      { label: '适合屏幕', keys: ['Shift', '1'] },
      { label: '缩放至 100%', keys: [SHORTCUT_MOD_KEY, '0'] },
      { label: '移动画布', keys: ['Space', '（按住）'] },
      { label: '上传图片/视频', keys: ['Shift', 'A'] },
    ],
  },
  {
    title: '图层',
    items: [
      { label: '置于顶层', keys: [']'] },
      { label: '上移一层', keys: [SHORTCUT_MOD_KEY, ']'] },
      { label: '置于底层', keys: ['['] },
      { label: '下移一层', keys: [SHORTCUT_MOD_KEY, '['] },
    ],
  },
]
