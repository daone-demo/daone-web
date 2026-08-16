import { decodeDisplayText } from '@/utils/decodeDisplayText'

export const VIDEO_NODE_TOOLBAR = {
  chat: { key: 'chat', label: '对话', icon: 'chat' as const },
  actions: [
    { key: 'clip', label: '视频剪辑', icon: 'video-edit' },
    { key: 'parse', label: '解析', icon: 'wand' },
    { key: 'hd', label: 'HD 高清', icon: 'video-hd' },
    { key: 'frames', label: '抽帧', icon: 'frames' },
    { key: 'replicate', label: '复刻', icon: 'replicate' },
    { key: 'watermark', label: '去水印', icon: 'watermark' },
    { key: 'subtitle', label: '去字幕', icon: 'subtitle' },
    { key: 'addToDialog', label: '', icon: 'addToDialog' },
  ] satisfies ImageToolbarAction[],
} as const

export type ImageToolbarIcon =
  | 'chat'
  | 'cutout'
  | 'crop'
  | 'edit'
  | 'preview'
  | 'more'
  | 'back'
  | 'split'
  | 'annotate'
  | 'decompose'
  | 'erase'
  | 'search'
  | 'parse'
  | 'download'
  | 'expand'
  | 'restore'
  | 'perspective'
  | 'text-edit'
  | 'adjust'
  | 'layers'
  | 'svg'
  | 'customize'
  | 'video-edit'
  | 'wand'
  | 'video-hd'
  | 'frames'
  | 'replicate'
  | 'watermark'
  | 'rotate'
  | 'flip'
  | 'subtitle'
  | 'addToDialog'

export type ImageToolbarAction = {
  key: string
  label: string
  icon?: ImageToolbarIcon
}

/** 图片节点工具栏点击事件（子组件上报 key/option/label，assetId 由画布层解析） */
export type ImageToolbarClickPayload = {
  key: string
  option?: string
  /** 能力展示名，用于结果节点 title */
  label?: string
}

/** 图片节点工具栏点击上下文（含当前图片素材 ID） */
export type ImageToolbarClickEvent = ImageToolbarClickPayload & {
  assetId: string
}

/** 视频节点工具栏点击事件（与图片工具栏平行，保持独立） */
export type VideoToolbarClickPayload = {
  key: string
  option?: string
  /** 能力展示名，用于结果节点 title */
  label?: string
}

/** 视频节点工具栏点击上下文（含当前视频素材 ID） */
export type VideoToolbarClickEvent = VideoToolbarClickPayload & {
  assetId: string
}

/** 由工具栏 action 名生成结果节点标题 */
export function buildImageActionResultTitle(label?: string, fallback = '生成结果') {
  const name = label?.trim()
  if (!name) return fallback
  if (/结果$/.test(name)) return name
  return `${name}`
}

/** 视频工具栏结果节点标题（独立函数，避免与图片侧耦合） */
export function buildVideoActionResultTitle(label?: string, fallback = '视频结果') {
  const name = label?.trim()
  if (!name) return fallback
  if (/结果$/.test(name)) return name
  return `${name}`
}

export type ImageToolbarMenuItem = {
  key: string
  label: string
  icon: ImageToolbarIcon
  hasSubmenu?: boolean
}

/** 后端 /canvas/capabilities 返回的图片能力项 */
export type ImageCapabilityToolbarMode = {
  label: string
  value: string
}

export type ImageCapabilityToolbar = {
  type?: 'button' | 'dropdown' | string
  group?: string
  order?: number
  visible?: boolean
  modes?: ImageCapabilityToolbarMode[]
}

export type ImageCapability = {
  code: string
  name: string
  icon?: string
  nodeType?: string
  implemented?: boolean
  basePoints?: number
  parameters?: Record<string, unknown>
  toolbar?: ImageCapabilityToolbar
}

/** 工具栏渲染用的能力 action（由 imageCapabilities 映射） */
export type ImageCapabilityToolbarAction = {
  key: string
  label: string
  icon?: string
  type: 'button' | 'dropdown'
  modes: ImageCapabilityToolbarMode[]
  order: number
  capability: ImageCapability
}

/** 后端 icon 名 → 画布工具栏 data-icon */
const CAPABILITY_ICON_MAP: Record<string, string> = {
  scissors: 'cutout',
  cutout: 'cutout',
  image: 'image',
  crop: 'crop',
  edit: 'edit',
  preview: 'preview',
  more: 'more',
  hd: 'video-hd',
  'video-hd': 'video-hd',
  wand: 'wand',
  frames: 'frames',
  replicate: 'replicate',
  watermark: 'watermark',
  subtitle: 'subtitle',
  'minus-square': 'subtitle',
  'video-edit': 'video-edit',
  scissors2: 'video-edit',
}

export function resolveCapabilityToolbarIcon(icon?: string): string | undefined {
  if (!icon) return undefined
  return CAPABILITY_ICON_MAP[icon] ?? icon
}

/** 视频能力 code → 工具栏 data-icon（接口 icon 缺失时兜底） */
const VIDEO_CAPABILITY_ICON_BY_CODE: Record<string, string> = {
  VIDEO_HD: 'video-hd',
  VIDEO_ANALYZE: 'wand',
  VIDEO_CLONE: 'replicate',
  VIDEO_WATERMARK_RM: 'watermark',
  VIDEO_SUBTITLE_RM: 'subtitle',
  VIDEO_FRAMES: 'frames',
  VIDEO_CLIP: 'video-edit',
}

/** 视频能力 code → 本地 UI key（用于面板开关等） */
const VIDEO_CAPABILITY_UI_KEY: Record<string, string> = {
  VIDEO_HD: 'hd',
  VIDEO_ANALYZE: 'parse',
  VIDEO_CLONE: 'replicate',
  VIDEO_WATERMARK_RM: 'watermark',
  VIDEO_SUBTITLE_RM: 'subtitle',
  VIDEO_FRAMES: 'frames',
  VIDEO_CLIP: 'clip',
}

export function resolveVideoToolbarUiKey(code: string): string {
  return VIDEO_CAPABILITY_UI_KEY[code] ?? code
}

export function resolveVideoToolbarIcon(code: string, icon?: string): string | undefined {
  return resolveCapabilityToolbarIcon(icon) ?? VIDEO_CAPABILITY_ICON_BY_CODE[code]
}

/** 不进图片节点工具栏的能力（纯文生图入口，无选中源图） */
const IMAGE_TOOLBAR_EXCLUDED_CODES = new Set(['IMAGE_GENERAL_V1', 'Custom_tool'])

/** 不进视频节点工具栏的能力（通用视频生成入口） */
const VIDEO_TOOLBAR_EXCLUDED_CODES = new Set(['VIDEO_GENERAL_V1'])

function normalizeCapabilityToolbarModes(
  modes: ImageCapabilityToolbarMode[] | undefined,
): ImageCapabilityToolbarMode[] {
  if (!Array.isArray(modes)) return []
  return modes.map((mode) => ({
    ...mode,
    label: decodeDisplayText(mode.label),
  }))
}

/** 兼容接口直接返回数组，或包在 records/list/data 里 */
export function normalizeImageCapabilities(
  capabilities: ImageCapability[] | null | undefined | Record<string, unknown>,
): ImageCapability[] {
  if (Array.isArray(capabilities)) return capabilities
  if (!capabilities || typeof capabilities !== 'object') return []
  const obj = capabilities as Record<string, unknown>
  if (Array.isArray(obj.records)) return obj.records as ImageCapability[]
  if (Array.isArray(obj.list)) return obj.list as ImageCapability[]
  if (Array.isArray(obj.data)) return obj.data as ImageCapability[]
  if (Array.isArray(obj.items)) return obj.items as ImageCapability[]
  return []
}

export const IMAGE_GENERAL_CAPABILITY_CODE = 'IMAGE_GENERAL_V1'

/** /canvas/capabilities 返回的能力码与能力名，供提交任务前校正 capabilityCode */
const registeredCapabilityCodes = new Set<string>()
const registeredCapabilityCodeByName = new Map<string, string>()

export function registerCanvasCapabilities(
  capabilities: ImageCapability[] | null | undefined,
) {
  for (const item of capabilities ?? []) {
    const code = String(item?.code ?? '').trim()
    if (!code) continue
    registeredCapabilityCodes.add(code)
    const name = String(item?.name ?? '').trim()
    if (name) registeredCapabilityCodeByName.set(name, code)
  }
}

/** 按能力名（节点标题前缀即由能力名生成）查后端能力码 */
export function findCapabilityCodeByName(name: string): { code: string; label: string } | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const exact = registeredCapabilityCodeByName.get(trimmed)
  if (exact) return { code: exact, label: trimmed }
  for (const [label, code] of registeredCapabilityCodeByName) {
    if (trimmed.includes(label)) return { code, label }
  }
  return null
}

/** 工具栏兜底常量里的本地 UI key → 后端能力码 */
const UI_KEY_TO_CAPABILITY_CODE = new Map<string, string>([
  ['crop', 'IMAGE_CROP'],
  ['inpaint', 'IMAGE_INPAINT'],
  ['preview', 'IMAGE_PREVIEW'],
  ['expand', 'IMAGE_EXPAND'],
  ['grid-split', 'IMAGE_GRID_SPLIT'],
  ['text-edit', 'IMAGE_EDIT_TEXT'],
  ['customize', 'IMAGE_CUSTOM'],
])

/** 后端能力码统一是 XXX_YYY 形式，单词型标识只可能是前端 UI key */
function looksLikeCapabilityCode(code: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+$/.test(code)
}

/**
 * 提交生成任务前校正能力码。
 * 工具栏兜底常量与旧工作流快照里可能残留 hd / crop 之类的本地 UI key，
 * 直接提交会被后端判为「AI 能力不存在」，此处回退到 fallback 能力。
 */
export function resolveSubmittableCapabilityCode(
  code: string | undefined | null,
  fallback: string,
): string {
  const trimmed = String(code ?? '').trim()
  if (!trimmed) return fallback
  if (registeredCapabilityCodes.has(trimmed)) return trimmed
  const mapped = UI_KEY_TO_CAPABILITY_CODE.get(trimmed)
  if (mapped) {
    if (registeredCapabilityCodes.size > 0 && !registeredCapabilityCodes.has(mapped)) return fallback
    return mapped
  }
  if (looksLikeCapabilityCode(trimmed)) return trimmed
  return fallback
}

/** AI 生成任务完整参数快照（随节点 data 持久化，用于溯源与重试） */
export interface CanvasGenerationParams {
  taskType: 'IMAGE' | 'TEXT' | 'MODEL' | 'VIDEO'
  capabilityCode: string
  prompt: string
  parameters: Record<string, unknown>
  workflowId?: string | number
  referenceAssetIds?: string[]
}

/**
 * 从 imageCapabilities 生成图片节点工具栏 actions。
 * 仅展示 toolbar.visible === true 的已实现能力；排除 IMAGE_GENERAL_V1。
 * 顺序：先按 toolbar.order，相同时按接口数组下标（接口返回顺序）稳定排序。
 */
export function buildImageToolbarActionsFromCapabilities(
  capabilities: ImageCapability[] | null | undefined | Record<string, unknown>,
): ImageCapabilityToolbarAction[] {
  const list = normalizeImageCapabilities(capabilities)
  if (!list.length) return []

  const mapped = list
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!item?.code || !item?.name) return false
      if (item.implemented === false) return false
      if (IMAGE_TOOLBAR_EXCLUDED_CODES.has(item.code)) return false
      if (item.nodeType && item.nodeType !== 'IMAGE') return false
      if (item.toolbar?.visible !== true) return false
      return true
    })
    .map(({ item, index }) => {
      const toolbar = item.toolbar
      const type = toolbar?.type === 'dropdown' ? 'dropdown' : 'button'
      return {
        key: item.code,
        label: decodeDisplayText(item.name),
        icon: resolveCapabilityToolbarIcon(item.icon),
        type,
        modes: normalizeCapabilityToolbarModes(toolbar?.modes),
        order: typeof toolbar?.order === 'number' ? toolbar.order : index,
        capability: item,
        _index: index,
      } satisfies ImageCapabilityToolbarAction & { _index: number }
    })
    .sort((a, b) => a.order - b.order || a._index - b._index)
    .map(({ _index, ...action }) => action)

  const seen = new Set<string>()
  return mapped.filter((item) => {
    if (seen.has(item.key)) return false
    seen.add(item.key)
    return true
  })
}

/**
 * 从 videoCapabilities 生成视频节点工具栏 actions。
 * 仅展示 toolbar.visible === true 的已实现能力；排除 VIDEO_GENERAL_V1。
 * 顺序与图片工具栏一致：先按 toolbar.order，相同时按接口数组下标。
 */
export function buildVideoToolbarActionsFromCapabilities(
  capabilities: ImageCapability[] | null | undefined | Record<string, unknown>,
): ImageCapabilityToolbarAction[] {
  const list = normalizeImageCapabilities(capabilities)
  if (!list.length) return []

  const mapped = list
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!item?.code || !item?.name) return false
      if (item.implemented === false) return false
      if (VIDEO_TOOLBAR_EXCLUDED_CODES.has(item.code)) return false
      if (item.nodeType && item.nodeType !== 'VIDEO') return false
      if (item.toolbar?.visible !== true) return false
      return true
    })
    .map(({ item, index }) => {
      const toolbar = item.toolbar
      const type = toolbar?.type === 'dropdown' ? 'dropdown' : 'button'
      return {
        key: item.code,
        label: decodeDisplayText(item.name),
        icon: resolveVideoToolbarIcon(item.code, item.icon),
        type,
        modes: normalizeCapabilityToolbarModes(toolbar?.modes),
        order: typeof toolbar?.order === 'number' ? toolbar.order : index,
        capability: item,
        _index: index,
      } satisfies ImageCapabilityToolbarAction & { _index: number }
    })
    .sort((a, b) => a.order - b.order || a._index - b._index)
    .map(({ _index, ...action }) => action)

  const seen = new Set<string>()
  return mapped.filter((item) => {
    if (seen.has(item.key)) return false
    seen.add(item.key)
    return true
  })
}

/** 图片工具栏主栏最多展示的 action 数，超出部分进「更多」 */
export const IMAGE_TOOLBAR_VISIBLE_ACTION_LIMIT = 6

export const IMAGE_NODE_TOOLBAR = {
  chat: { key: 'chat', label: '对话', icon: 'chat' as const },
  /** 固定项：加入对话，始终排在 actions 区最前，不计入 6 个上限 */
  addToDialog: { key: 'addToDialog', label: '', icon: 'addToDialog' as const },
  more: { key: 'more', label: '更多', icon: 'more' as const },
  /** capabilities 未返回时的兜底 actions（不含固定项 /「更多」） */
  actions: [
    { key: 'IMAGE_REMOVE_BG', label: '抠图', icon: 'cutout' },
    { key: 'hd', label: 'HD 高清' },
    { key: 'crop', label: '裁剪', icon: 'crop' },
    { key: 'inpaint', label: '局部修改', icon: 'edit' },
    { key: 'preview', label: '预览', icon: 'preview' },
  ] satisfies ImageToolbarAction[],
} as const

const IMAGE_TOOLBAR_FIXED_ACTION_KEYS = new Set(['more', 'addToDialog', 'chat', 'download'])

/** 将静态兜底 actions 转成与 capabilities 相同的结构 */
export function toCapabilityToolbarActions(
  actions: readonly ImageToolbarAction[],
): ImageCapabilityToolbarAction[] {
  return actions
    .filter((item) => !IMAGE_TOOLBAR_FIXED_ACTION_KEYS.has(item.key))
    .map((item, index) => ({
      key: item.key,
      label: item.label,
      icon: item.icon,
      type: item.key === 'IMAGE_REMOVE_BG' ? 'dropdown' : 'button',
      modes:
        item.key === 'IMAGE_REMOVE_BG'
          ? [
              { label: '快速', value: 'quick' },
              { label: '精准', value: 'precise' },
              { label: '擦除', value: 'erase' },
            ]
          : [],
      order: index,
      capability: {
        code: item.key,
        name: item.label,
        icon: item.icon,
        implemented: true,
        toolbar: {
          type: item.key === 'IMAGE_REMOVE_BG' ? 'dropdown' : 'button',
          group: 'edit',
          visible: true,
          order: index,
        },
      },
    }))
}

/** 主栏 actions + 更多溢出（超过 IMAGE_TOOLBAR_VISIBLE_ACTION_LIMIT；固定项已预先剔除） */
export function splitImageToolbarActions(
  actions: ImageCapabilityToolbarAction[],
  limit = IMAGE_TOOLBAR_VISIBLE_ACTION_LIMIT,
) {
  const list = actions.filter((item) => !IMAGE_TOOLBAR_FIXED_ACTION_KEYS.has(item.key))
  return {
    primaryActions: list.slice(0, limit),
    overflowActions: list.slice(limit),
  }
}

/** 固定的「加入对话」action（供工具栏渲染） */
export function createAddToDialogToolbarAction(): ImageCapabilityToolbarAction {
  return {
    key: IMAGE_NODE_TOOLBAR.addToDialog.key,
    label: IMAGE_NODE_TOOLBAR.addToDialog.label,
    icon: IMAGE_NODE_TOOLBAR.addToDialog.icon,
    type: 'button',
    modes: [],
    order: -1,
    capability: {
      code: IMAGE_NODE_TOOLBAR.addToDialog.key,
      name: '加入对话',
      icon: IMAGE_NODE_TOOLBAR.addToDialog.icon,
      implemented: true,
      toolbar: { type: 'button', group: 'fixed', visible: true, order: -1 },
    },
  }
}

export const IMAGE_NODE_TOOLBAR_MORE = {
  actions: [
    { key: 'split', label: '拆图', icon: 'split' },
    { key: 'annotate', label: '标注', icon: 'annotate' },
    { key: 'decompose', label: '元素拆解', icon: 'decompose' },
    { key: 'erase', label: '消除', icon: 'erase' },
    { key: 'search', label: '搜同款', icon: 'search' },
    { key: 'parse', label: '解析', icon: 'parse' },
    { key: 'more', label: '更多', icon: 'more' },
  ] satisfies ImageToolbarAction[],
} as const

export const IMAGE_NODE_CREATIVE_TOOLBAR = {
  actions: [
    // 未联调能力：隐藏，避免 UI key 被当作 capabilityCode 提交
    // { key: 'panorama', label: '全景', badge: 'NEW' },
    // { key: 'multi-angle', label: '多角度' },
    // { key: 'lighting', label: '打光' },
    // { key: 'grid', label: '九宫格' },
    // { key: 'hd', label: '高清' },
    { key: 'grid-split', label: '宫格切分' },
  ],
  icons: [
    // { key: 'rotate', label: '旋转', icon: 'rotate' },
    // { key: 'flip', label: '翻转', icon: 'flip' },
    { key: 'download', label: '下载', icon: 'download' },
    { key: 'expand', label: '展开', icon: 'expand' },
  ] satisfies ImageToolbarAction[],
} as const

export const IMAGE_NODE_TOOLBAR_MORE_MENU = [
  { key: 'expand', label: '扩图', icon: 'expand' },
  { key: 'restore', label: '细节还原', icon: 'restore' },
  { key: 'perspective', label: '多视角', icon: 'perspective' },
  { key: 'text-edit', label: '编辑文字', icon: 'text-edit' },
  { key: 'adjust', label: '调节', icon: 'adjust', hasSubmenu: true },
  { key: 'layers', label: '图层分离', icon: 'layers' },
  { key: 'svg', label: '矢量SVG', icon: 'svg', hasSubmenu: true },
  { key: 'customize', label: '自定义', icon: 'customize' },
] satisfies ImageToolbarMenuItem[]
