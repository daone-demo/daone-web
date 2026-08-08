import { decodeDisplayText } from '@/utils/decodeDisplayText'

export type NodeKind = 'text' | 'image' | 'video' | 'audio' | 'model3d'

export type NodeMode = 'picker' | 'editor'

export type UploadState = 'idle' | 'uploading' | 'done'

export type ImageGenTask = 'picker' | 'img2img' | 'hd'

/** 画布图片节点拖入对话框时 dataTransfer 的 MIME 类型 */
export const CANVAS_IMAGE_NODE_DRAG_TYPE = 'application/x-canvas-image-node-id'

/** 素材面板图片拖入画布时 dataTransfer 的 MIME 类型 */
export const CANVAS_ASSET_DRAG_TYPE = 'application/x-canvas-asset'

export interface CanvasAssetDragPayload {
  assetId?: string
  previewUrl: string
  fileName?: string
  width?: number | null
  height?: number | null
  mediaType?: 'IMAGE' | 'VIDEO'
}

/** Skill / 元素组拖入画布时 dataTransfer 的 MIME 类型 */
export const CANVAS_ELEMENT_GROUP_DRAG_TYPE = 'application/x-canvas-element-group'

export interface CanvasElementGroupDragPayload {
  recordId: string
  name: string
  structureJson: unknown
}

/** 由上游节点连线带过来的图片输入源 */
export interface ImageSourceRef {
  nodeId: string
  /** 素材库资源 ID（上传接口返回的 id） */
  assetId?: string
  previewUrl: string
  fileName?: string
}

export interface ImageMarkBBox {
  x: number
  y: number
  width: number
  height: number
}

/** 图片元素标记（局部识别结果） */
export interface ImageMarkItem {
  id: string
  label: string
  /** 识别候选标签（多个结果时可切换） */
  labelOptions?: string[]
  /** 当前选中的候选索引 */
  selectedLabelIndex?: number
  description?: string
  /** 点击位置（原图像素坐标） */
  x: number
  y: number
  bbox?: ImageMarkBBox
  sourceNodeId: string
  assetId: string
  imageWidth: number
  imageHeight: number
  /** 插入输入框的可删除 mention 文本 */
  mentionToken: string
  /** 识别进行中（展示 loading 态，完成后清除） */
  pending?: boolean
}

export interface CanvasNodeData {
  kind: NodeKind
  title: string
  mode: NodeMode
  content: string
  uploadState: UploadState
  uploadProgress: number
  mediaWidth: number
  mediaHeight: number
  previewUrl: string
  fileName: string
  /** 本节点对应素材库资源 ID（上传接口返回的 id） */
  assetId?: string
  isSelected?: boolean
  /** 宫格碎片：仅单独选中时展示连线加号 */
  showConnectPlus?: boolean
  /** 连线添加上下文菜单打开时隐藏节点标题栏 */
  hideNodeMeta?: boolean
  /** 节点所属分组 ID，同组节点可整组移动与解组 */
  groupId?: string
  imageGenTask?: ImageGenTask
  sourceNodeId?: string
  sourcePreviewUrl?: string
  sourceFileName?: string
  /** 当前主图片来源对应的素材库资源 ID */
  sourceAssetId?: string
  /** 多个上游节点连线带过来的图片输入源（图生图多图参考），按连入顺序排列 */
  imageSourceRefs?: ImageSourceRef[]
  /** 图片对话面板输入的提示词（按节点独立保存） */
  imageDialogueText?: string
  /** 图片对话面板生成设置（比例、画质、模型、工作流等，按节点独立保存） */
  imageDialogueSettings?: Partial<ImageDialogueSettings>
  /** 视频对话面板输入的提示词（按节点独立保存，生成结果溯源） */
  videoDialogueText?: string
  /** 视频对话面板生成设置（模型、比例、清晰度等，按节点独立保存，生成结果溯源） */
  videoDialogueSettings?: Partial<VideoDialogueSettings>
  /**
   * 视频多图参考来源快照（全能参考/图生视频等）。
   * 与连线并行持久化，打开对话框时可溯源，并随画布写入数据库。
   */
  videoSourceRefs?: ImageSourceRef[]
  inputUpdated?: boolean
  genPrompt?: string
  genSeed?: number
  videoGenTab?: string
  /** 视频生成面板所选比例，用于空节点/生成中节点的预览尺寸 */
  videoGenAspectRatio?: string
  viewScale?: number
  editorWidth?: number
  editorHeight?: number
  /** 宫格拆分碎片：无标题栏，节点尺寸即预览区 */
  compactPreview?: boolean
  /** 宫格拆分碎片在网格中的位置 */
  gridSplitTile?: {
    row: number
    col: number
    rows: number
    cols: number
  }
  textPickerTask?: 'img2prompt' | 'text2video' | 'text2image' | 'write' | ''
  /** 自由输入提示词生成后，底部输入框保持显示 */
  promptBarPinned?: boolean
  textGenState?: 'idle' | 'loading' | 'done' | 'failed'
  /** 图片反推提示词生成进度（0-100），loading 时用于显示「准备中 / 生成中 X%」 */
  textGenProgress?: number
  linkedImageNodeId?: string
  /** 文生图节点生成态：idle 待生成 / loading 生成中 / done 已生成 / failed 生成失败 */
  imageGenState?: 'idle' | 'loading' | 'done' | 'failed'
  /** 生成失败时的说明文案（展示在节点失败面板） */
  generationFailMessage?: string
  /** 文生图生成进度（0-100） */
  imageGenProgress?: number
  /** 关联的后端生成任务 ID，用于多任务并发追踪与刷新后恢复 */
  generationTaskId?: string
  /** 关联生成任务类型，刷新后用于恢复轮询 */
  generationTaskType?: 'IMAGE' | 'TEXT' | 'MODEL' | 'VIDEO'
  /** AI 生成任务完整参数快照（提示词、模型、工作流、参考图等，随节点持久化） */
  generationParams?: CanvasGenerationParams
  /** 视频时长（秒） */
  durationSeconds?: number
  /** 图片元素标记（显示在图片节点上的识别框） */
  imageElementMarks?: ImageMarkItem[]
  /** 当前选中的图片元素标记 ID（用于键盘删除） */
  selectedImageElementMarkId?: string
  /** 当前是否正在分析标记点 */
  imageMarkAnalyzing?: { x: number; y: number } | null
  /** 元素标记模式下可作为标记目标的图片节点 */
  imageMarkTarget?: boolean
  /** 对话面板中的元素标记列表 */
  elementMarks?: ImageMarkItem[]
  /** 锁定后节点不可拖动 */
  nodeLocked?: boolean
}

/** 图片反推提示词默认示例图文件名 */
export const IMG2PROMPT_EXAMPLE_FILENAME = '示例图片.png'

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

export const TEXT_PROMPT_MODEL_LABEL = 'GVLM 3.1'

export type TextPromptModelItem = {
  key: string
  name: string
  duration: string
  desc?: string
}

export const TEXT_PROMPT_MODEL_MENU: TextPromptModelItem[] = [
  { key: 'gvlm-3-1', name: '反推提示词', duration: '', desc: '' },
  { key: 'cvlm-5-5', name: '小红书种草文案', duration: '' },
]

export const TEXT_PROMPT_PLACEHOLDER =
  '写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看星星。'

export const DEFAULT_GENERATION_FAIL_MESSAGE =
  '输出内容未通过安全审核,积分将会在10分钟内返还,请修改描述或者素材后重试'

export function normalizeGenerationFailMessage(_errorMessage?: string): string {
  return DEFAULT_GENERATION_FAIL_MESSAGE
}

export function resolveGenerationFailMessage(_data?: Partial<CanvasNodeData> | null): string {
  return DEFAULT_GENERATION_FAIL_MESSAGE
}

export function isCanvasGenerationFailed(data?: Partial<CanvasNodeData> | null): boolean {
  if (!data) return false
  if (data.imageGenState === 'failed' || data.textGenState === 'failed') return true
  return data.title === '生成失败'
}

export function createEmptyNodeData(): CanvasNodeData {
  return {
    kind: 'text',
    title: '',
    mode: 'picker',
    content: '',
    uploadState: 'idle',
    uploadProgress: 0,
    mediaWidth: 0,
    mediaHeight: 0,
    previewUrl: '',
    fileName: '',
  }
}

/** 从节点数据或图片来源引用中解析素材库资源 ID */
export function resolveImageAssetId(
  source?:
    | Pick<CanvasNodeData, 'assetId' | 'sourceAssetId'>
    | Pick<ImageSourceRef, 'assetId'>
    | null,
): string {
  if (!source) return ''
  if ('assetId' in source && source.assetId) return source.assetId
  if ('sourceAssetId' in source && source.sourceAssetId) return source.sourceAssetId
  return ''
}

/** 从视频节点数据解析素材库资源 ID（独立于图片侧） */
export function resolveVideoAssetId(
  source?: Pick<CanvasNodeData, 'assetId' | 'sourceAssetId'> | null,
): string {
  if (!source) return ''
  if (source.assetId) return source.assetId
  if (source.sourceAssetId) return source.sourceAssetId
  return ''
}

export const EMPTY_HINT = '双击画布 自由生成节点'

/** 图片节点标题栏高度 + 与预览区间距，用于工具栏锚定在图片区域正上方 */
export const IMAGE_NODE_META_HEIGHT = 30

/** 图片节点标题栏 + 间距（与 ImageNode 中 body 的 calc(100% - 24px) 一致） */
export const IMAGE_NODE_LAYOUT_META_HEIGHT = 24

/** 图片节点预览区容器上下边框 */
export const IMAGE_NODE_LAYOUT_BODY_BORDER = 2

/** 文本/图片/视频默认卡片宽与 2:3 比例（宽:高 = 2:3） */
export const NODE_DEFAULT_WIDTH = 180
export const NODE_DEFAULT_HEIGHT = 270

export function nodeCardSize2x3(width = NODE_DEFAULT_WIDTH) {
  return { width, height: Math.round(width * 3 / 2) }
}

/** 文本/音频 picker 底部输入框距节点底边的垂直间距（原 62px，缩小 2/3 后为 21px） */
export const PROMPT_BAR_TOP_GAP = 21

/** 视频节点与文生视频面板间距 */
export const VIDEO_GEN_PROMPT_TOP_GAP = 21

/** 连线/操作生成的新节点与源节点之间的默认间距（边到边） */
export const NODE_SPAWN_GAP_X = 150
export const NODE_SPAWN_GAP_Y = 80

export const CANVAS_MIN_ZOOM = 0.35
export const CANVAS_MAX_ZOOM = 2

export const ZOOM_MENU_PRESETS = [0.5, 1, 2] as const

export const NODE_TEMPLATES = [
  { kind: 'text' as const, label: '故事脚本生成', desc: '从创意生成完整故事脚本', accent: '#5b8def' },
  { kind: 'image' as const, label: '角色三视图', desc: '生成角色三视图与设定', accent: '#9b6bff' },
  { kind: 'video' as const, label: '首帧图生视频', desc: '静态图转动态视频', accent: '#3bc9a0' },
  { kind: 'audio' as const, label: '音频生视频', desc: '音频驱动画面生成', accent: '#f5a623' },
]

export type MenuIcon =
  | 'text'
  | 'image'
  | 'video'
  | 'compose'
  | 'director'
  | 'audio'
  | 'script'
  | 'upload'
  | 'history'
  | 'link'

export type ConnectMenuKey =
  | 'text'
  | 'image'
  | 'video'
  | 'compose'
  | 'director'
  | 'audio'
  | 'script'
  | 'reference'

export const CONNECT_GENERATE_MENU: Array<{
  key: ConnectMenuKey
  label: string
  icon: string
  badge?: 'Beta' | 'NEW'
  disabled?: boolean
}> = [
  { key: 'text', label: '文本', icon: 'icon-xingzhuang-wenzi' },
  { key: 'image', label: '图片', icon: 'icon-shangchuantupian1' },
  { key: 'video', label: '视频', icon: 'icon-shangchuanshipin2' },
]

export const ADD_NODE_GROUPS = [
  {
    title: '添加节点',
    items: [
      { kind: 'text' as const, label: '文本', desc: '脚本、广告词、品牌文案', action: 'upload-text' as const, icon: 'icon-xingzhuang-wenzi' },
      { kind: 'image' as const, label: '图片', desc: '海报、封面、素材图', action: 'upload-image' as const, icon: 'icon-shangchuantupian1' },
      { kind: 'video' as const, label: '视频', desc: '短视频、动画片段', action: 'upload-video' as const, icon: 'icon-shangchuanshipin2' },
    ],
  },
  {
    title: '添加资源',
    items: [
      { kind: 'image' as const, label: '上传', desc: '本地图片或视频', icon: 'upload' as MenuIcon, action: 'upload' as const },
      // { kind: 'image' as const, label: '从生成历史选择', desc: '复用历史结果', icon: 'history' as MenuIcon, action: 'history' as const },
    ],
  },
]

export const TEXT_PICKER_ACTIONS = [
  { key: 'write', label: '自己编写内容', icon: 'doc' },
  { key: 'text2image', label: '文生图', icon: 'image' },
  { key: 'text2video', label: '文生视频', icon: 'play' },
  // { key: 'text2music', label: '文字生音乐', icon: 'audio' },
]

export const TEXT_PICKER_TRY_ACTIONS = TEXT_PICKER_ACTIONS.filter(
  (action) => action.key === 'text2video' || action.key === 'text2image',
)

export const VIDEO_PICKER_TRY_ACTIONS = [
  { key: 'frames', label: '首尾帧生成视频', icon: 'frames' },
  { key: 'imageRef', label: '首帧生成视频', icon: 'spark' },
] as const

export const VIDEO_GEN_TABS: Array<{ key: string; label: string; disabled?: boolean; disabledHint?: string }> = [
  { key: 'text2video', label: '文生视频', disabled: true, disabledHint: '已接入媒体输入,无法使用纯文生视频' },
  { key: 'reference', label: '全能参考', disabled: false, disabledHint: '' },
  { key: 'img2video', label: '图生视频', disabled: false, disabledHint: '图生视频功能暂未开放' },
  { key: 'frames', label: '首尾帧', disabled: false, disabledHint: '首尾帧功能暂未开放' },
  { key: 'imageRef', label: '图片参考', disabled: false, disabledHint: '' },
]

export const VIDEO_GEN_QUICK_ACTIONS = [
  { key: 'mark', label: '标记', icon: 'mark' },
  { key: 'camera', label: '运镜', icon: 'camera' },
  { key: 'role', label: '角色库', icon: 'role' },
] as const

export const VIDEO_GEN_PROMPT_PLACEHOLDER = '描述你想要生成的画面内容，@引用素材'

export const IMAGE_GEN_ACTIONS = [
  { key: 'img2img' as const, label: '图生图', icon: 'img2img' },
  { key: 'hd' as const, label: '图片高清', icon: 'hd' },
]

export const IMG2IMG_PROMPT_PLACEHOLDER =
  '描述你想要生成的画面内容，按/呼出指令，@引用素材'

export const IMG2IMG_QUICK_TAGS = ['风格', '相似', '参考'] as const

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

/** AI 生成任务完整参数快照（随节点 data 持久化，用于溯源与重试） */
export interface CanvasGenerationParams {
  taskType: 'IMAGE' | 'TEXT' | 'MODEL' | 'VIDEO'
  capabilityCode: string
  prompt: string
  parameters: Record<string, unknown>
  workflowId?: string | number
  referenceAssetIds?: string[]
}

/** 图片对话面板生成设置（持久化到节点 data） */
export interface ImageDialogueSettings {
  aspectRatio: string
  resolution: string
  imageCount: number
  modelKey: string
  workflowId: string
}

/** 图片对话面板点击发送时上报的生成参数 */
export type ImageDialogueSubmitPayload = {
  prompt: string
  model: string
  aspectRatio: string
  count: number
  resolution?: string
  workflowId?: string | number
  workflow?: WorkflowRecord
}

/** 视频对话面板点击发送时上报的生成参数（与图片对话平行，保持独立） */
export type VideoDialogueMode =
  | 'text-to-video'
  | 'image-to-video'
  | 'reference'
  | 'first-last-frame'

export type VideoDialogueSubmitPayload = {
  prompt: string
  model: string
  ratio: string
  clarity: string
  duration: number
  generateAudio: boolean
  videoCount: number
  mode: VideoDialogueMode
}

/** 视频对话面板生成设置（持久化到节点 data） */
export interface VideoDialogueSettings {
  modelKey: string
  aspectRatio: VideoGenAspectRatio
  resolution: VideoGenResolution
  duration: VideoGenDuration
  generateAudio: boolean
  videoCount: number
  mode: VideoDialogueMode
}

/** 视频生成提示面板提交参数（与视频对话框平行，保持独立） */
export type VideoGenPromptSubmitPayload = {
  prompt: string
  model: string
  ratio: string
  clarity: string
  duration: number
  generateAudio: boolean
  videoCount: number
  mode: VideoDialogueMode
  tab: string
}

/** 视频生成面板 tab → VIDEO_GENERAL_V1 mode */
export function resolveVideoGenApiMode(tab: string): VideoDialogueMode {
  switch (tab) {
    case 'img2video':
      return 'image-to-video'
    case 'frames':
      return 'first-last-frame'
    case 'reference':
    case 'imageRef':
      return 'reference'
    case 'text2video':
    default:
      return 'text-to-video'
  }
}

export type WorkflowRecord = {
  id: string | number
  name: string
  description?: string
  type?: string
  buttonType?: string
  categoryId?: string | number | null
  categoryName?: string
  category?: { id?: string | number; name?: string } | null
  workflowJson?: string
  [key: string]: unknown
}

/** 工作流按钮类型：我的模特（弹出数字人选择器） */
export const WORKFLOW_BUTTON_TYPE_MY_MODEL = 'MY_MODEL'

export function resolveWorkflowButtonType(
  workflow: WorkflowRecord | null | undefined,
): string {
  if (!workflow) return ''
  const raw = workflow.buttonType ?? workflow.button_type
  return String(raw ?? '').trim().toUpperCase()
}

export function isMyModelWorkflow(
  workflow: WorkflowRecord | null | undefined,
): boolean {
  return resolveWorkflowButtonType(workflow) === WORKFLOW_BUTTON_TYPE_MY_MODEL
}

/** 创建生成任务时：MY_MODEL 工作流不传 workflowId */
export function resolveGenerationTaskWorkflowId(
  workflowId?: string | number | null,
  workflow?: WorkflowRecord | null,
): string | null {
  if (isMyModelWorkflow(workflow)) return null
  if (workflowId === undefined || workflowId === null || workflowId === '') return null
  return String(workflowId)
}

export type WorkflowCategoryGroup = {
  categoryId: string
  categoryName: string
  workflows: WorkflowRecord[]
}

export type ImageWorkflowOption = WorkflowRecord & { id: string; name: string }

export type ImageWorkflowOptionGroup = {
  categoryId: string
  categoryName: string
  children: ImageWorkflowOption[]
}

const UNCATEGORIZED_WORKFLOW_CATEGORY_ID = '__uncategorized__'

function resolveWorkflowCategoryId(workflow: WorkflowRecord): string {
  const raw = workflow.categoryId ?? workflow.category?.id
  if (raw === undefined || raw === null || raw === '') {
    return UNCATEGORIZED_WORKFLOW_CATEGORY_ID
  }
  return String(raw)
}

function resolveWorkflowCategoryName(workflow: WorkflowRecord, categoryId: string): string {
  if (categoryId === UNCATEGORIZED_WORKFLOW_CATEGORY_ID) return '未分类'
  const raw = workflow.categoryName ?? workflow.category?.name
  if (raw !== undefined && raw !== null && String(raw).trim()) {
    return String(raw)
  }
  return `分类 ${categoryId}`
}

function normalizeWorkflowOption(workflow: WorkflowRecord): ImageWorkflowOption {
  return {
    ...workflow,
    id: String(workflow.id),
    name: String(workflow.name || workflow.description || workflow.id),
  }
}

export function isWorkflowCategoryGroup(
  value: WorkflowRecord | WorkflowCategoryGroup,
): value is WorkflowCategoryGroup {
  return Array.isArray((value as WorkflowCategoryGroup).workflows)
}

/** 将工作流列表按 categoryId 聚合为二级菜单结构 */
export function groupWorkflowsByCategory(
  workflows: WorkflowRecord[] | null | undefined,
): WorkflowCategoryGroup[] {
  const groups = new Map<string, WorkflowCategoryGroup>()

  for (const workflow of Array.isArray(workflows) ? workflows : []) {
    if (workflow?.id === undefined || workflow?.id === null) continue
    const categoryId = resolveWorkflowCategoryId(workflow)
    let group = groups.get(categoryId)
    if (!group) {
      group = {
        categoryId,
        categoryName: resolveWorkflowCategoryName(workflow, categoryId),
        workflows: [],
      }
      groups.set(categoryId, group)
    }
    group.workflows.push(workflow)
  }

  return Array.from(groups.values())
}

export function flattenWorkflowCategoryGroups(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): WorkflowRecord[] {
  if (!Array.isArray(workflows) || !workflows.length) return []
  if (isWorkflowCategoryGroup(workflows[0])) {
    return (workflows as WorkflowCategoryGroup[]).flatMap((group) => group.workflows)
  }
  return workflows as WorkflowRecord[]
}

/** 仅保留 type 为 IMAGE 的工作流（兼容大小写与 TYPE 字段） */
export function isImageWorkflowRecord(workflow: WorkflowRecord | null | undefined): boolean {
  if (!workflow) return false
  const type = String(workflow.type ?? workflow.TYPE ?? '').trim().toUpperCase()
  return type === 'IMAGE'
}

/** 仅保留 type 为 VIDEO 的工作流（兼容大小写与 TYPE 字段） */
export function isVideoWorkflowRecord(workflow: WorkflowRecord | null | undefined): boolean {
  if (!workflow) return false
  const type = String(workflow.type ?? workflow.TYPE ?? '').trim().toUpperCase()
  return type === 'VIDEO'
}

/** 仅保留 type 为 TEXT 的工作流（兼容大小写与 TYPE 字段） */
export function isTextWorkflowRecord(workflow: WorkflowRecord | null | undefined): boolean {
  if (!workflow) return false
  const type = String(workflow.type ?? workflow.TYPE ?? '').trim().toUpperCase()
  return type === 'TEXT'
}

/** 图片对话/文生图对话框共用：从 workflows 列表解析 IMAGE 类型选项 */
export function buildImageWorkflowOptions(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOption[] {
  return flattenWorkflowCategoryGroups(workflows)
    .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
    .filter(isImageWorkflowRecord)
    .map(normalizeWorkflowOption)
}

/** 图片对话/文生图对话框共用：按 categoryId 输出二级菜单选项 */
export function buildImageWorkflowOptionGroups(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOptionGroup[] {
  if (!Array.isArray(workflows) || !workflows.length) return []

  if (isWorkflowCategoryGroup(workflows[0])) {
    return (workflows as WorkflowCategoryGroup[])
      .map((group) => ({
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        children: group.workflows
          .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
          .filter(isImageWorkflowRecord)
          .map(normalizeWorkflowOption),
      }))
      .filter((group) => group.children.length > 0)
  }

  return groupWorkflowsByCategory(buildImageWorkflowOptions(workflows))
    .map((group) => ({
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      children: group.workflows.map(normalizeWorkflowOption),
    }))
    .filter((group) => group.children.length > 0)
}

/** 视频对话面板：从 workflows 列表解析 VIDEO 类型选项 */
export function buildVideoWorkflowOptions(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOption[] {
  return flattenWorkflowCategoryGroups(workflows)
    .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
    .filter(isVideoWorkflowRecord)
    .map(normalizeWorkflowOption)
}

/** 视频对话面板：按 categoryId 输出二级菜单选项（仅 VIDEO） */
export function buildVideoWorkflowOptionGroups(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOptionGroup[] {
  if (!Array.isArray(workflows) || !workflows.length) return []

  if (isWorkflowCategoryGroup(workflows[0])) {
    return (workflows as WorkflowCategoryGroup[])
      .map((group) => ({
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        children: group.workflows
          .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
          .filter(isVideoWorkflowRecord)
          .map(normalizeWorkflowOption),
      }))
      .filter((group) => group.children.length > 0)
  }

  return groupWorkflowsByCategory(buildVideoWorkflowOptions(workflows))
    .map((group) => ({
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      children: group.workflows.map(normalizeWorkflowOption),
    }))
    .filter((group) => group.children.length > 0)
}

/** 文本节点提示栏：从 workflows 列表解析 TEXT 类型选项 */
export function buildTextWorkflowOptions(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOption[] {
  return flattenWorkflowCategoryGroups(workflows)
    .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
    .filter(isTextWorkflowRecord)
    .map(normalizeWorkflowOption)
}

/** 文本节点提示栏：按 categoryId 输出二级菜单选项（仅 TEXT） */
export function buildTextWorkflowOptionGroups(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOptionGroup[] {
  if (!Array.isArray(workflows) || !workflows.length) return []

  if (isWorkflowCategoryGroup(workflows[0])) {
    return (workflows as WorkflowCategoryGroup[])
      .map((group) => ({
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        children: group.workflows
          .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
          .filter(isTextWorkflowRecord)
          .map(normalizeWorkflowOption),
      }))
      .filter((group) => group.children.length > 0)
  }

  return groupWorkflowsByCategory(buildTextWorkflowOptions(workflows))
    .map((group) => ({
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      children: group.workflows.map(normalizeWorkflowOption),
    }))
    .filter((group) => group.children.length > 0)
}

export type ChatTools = {
  image?: ImageCapability | null
  text?: ImageCapability | null
  video?: ImageCapability | null
}

export type ImageDialogueSource =
  | ImageCapability[]
  | ImageCapability
  | ChatTools
  | null
  | undefined
  | Record<string, unknown>

/** 解析图片对话面板数据源：优先 chatTools.image，其次 capabilities 列表 */
export function findImageDialogueSource(source: ImageDialogueSource): ImageCapability | null {
  if (!source || typeof source !== 'object') return null

  if ('image' in source) {
    const image = (source as ChatTools).image
    if (image && typeof image === 'object') return image
  }

  if ('parameters' in source && ('code' in source || 'nodeType' in source)) {
    return source as ImageCapability
  }

  return findImageGeneralCapability(source)
}

/** 从 capabilities 中取指定 code 的能力项 */
export function findImageCapability(
  capabilities: ImageCapability[] | null | undefined | Record<string, unknown>,
  code: string,
): ImageCapability | null {
  const list = normalizeImageCapabilities(capabilities)
  return list.find((item) => item.code === code) ?? null
}

export function findImageGeneralCapability(
  capabilities: ImageCapability[] | null | undefined | Record<string, unknown>,
): ImageCapability | null {
  return findImageCapability(capabilities, IMAGE_GENERAL_CAPABILITY_CODE)
}

function parseCapabilityStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

/** chat-tools parameters.modelOptions: [{ value, label, ... }] */
function parseCapabilityModelOptions(value: unknown): Array<{
  value: string
  label: string
  icon?: string
  duration?: string
  desc?: string
  badge?: string
}> {
  if (!Array.isArray(value)) return []
  const result: Array<{
    value: string
    label: string
    icon?: string
    duration?: string
    desc?: string
    badge?: string
  }> = []

  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      result.push({ value: item.trim(), label: item.trim() })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const rawValue = row.value ?? row.key ?? row.id ?? row.model
    const valueText = typeof rawValue === 'string' ? rawValue.trim() : ''
    if (!valueText) continue
    const rawLabel = row.label ?? row.name ?? row.title
    const labelText =
      typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : valueText
    result.push({
      value: valueText,
      label: labelText,
      icon: typeof row.icon === 'string' && row.icon.trim() ? row.icon.trim() : undefined,
      duration: typeof row.duration === 'string' ? row.duration : undefined,
      desc:
        typeof row.desc === 'string'
          ? row.desc
          : typeof row.description === 'string'
            ? row.description
            : undefined,
      badge:
        typeof row.badge === 'string'
          ? row.badge
          : typeof row.tag === 'string'
            ? row.tag
            : undefined,
    })
  }

  return result
}

function resolveImageDialogueModelIcon(key: string, index: number): ImageDialogueModelIcon {
  const lower = key.toLowerCase()
  if (lower.includes('midjourney') || lower.includes('mj')) return 'mj'
  if (lower.includes('seedream') || lower.includes('seed')) return 'seedream'
  if (lower.includes('navo')) return 'navo'
  if (lower.includes('gpt') || lower.includes('gemini') || lower.includes('image')) return 'lib'
  return index === 0 ? 'lib' : 'seedream'
}

/** 接口 icon 与本地 iconfont 类名不一致时的别名 */
const DIALOGUE_MODEL_ICON_ALIASES: Record<string, string> = {
  'icon-jinengAI': 'icon-jimengAI',
  'icon-JimengAI': 'icon-jimengAI',
  'icon-nano-banana-pro': 'icon-nano-banana',
  'icon-huoshanyingying': 'icon-huoshanyinqing',
}

/** 规范化接口返回的模型 icon（iconfont 类名） */
export function normalizeDialogueModelIcon(icon?: string | null): string {
  const text = String(icon ?? '').trim()
  if (!text) return ''
  return DIALOGUE_MODEL_ICON_ALIASES[text] ?? text
}

/** 是否为 iconfont 类名（如 icon-ChatGPT） */
export function isDialogueModelIconfont(icon?: string | null): boolean {
  return normalizeDialogueModelIcon(icon).startsWith('icon-')
}

function resolveImageDialogueModelItemIcon(
  apiIcon: string | undefined,
  key: string,
  index: number,
): ImageDialogueModelIcon | string {
  const normalized = normalizeDialogueModelIcon(apiIcon)
  if (normalized) return normalized
  return resolveImageDialogueModelIcon(key, index)
}

function parseCapabilityCountRange(parameters?: Record<string, unknown>): number[] {
  const count = parameters?.count
  if (Array.isArray(count)) {
    return count
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0)
  }
  if (count && typeof count === 'object') {
    const range = count as { min?: number; max?: number; default?: number }
    const min = Math.max(1, Math.floor(Number(range.min) || 1))
    const max = Math.max(min, Math.floor(Number(range.max) || min))
    const options: number[] = []
    for (let value = min; value <= max; value += 1) options.push(value)
    return options
  }
  return []
}

function resolveAspectRatioPreview(ratio: string): { width: number; height: number } {
  const preset = IMAGE_GEN_ASPECT_RATIOS.find((item) => item.key === ratio)
  if (preset) return preset.preview

  if (ratio === 'auto') return { width: 14, height: 10 }

  const parts = ratio.split(':').map((part) => Number(part.trim()))
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
    const max = 16
    if (parts[0] >= parts[1]) {
      return { width: max, height: Math.max(6, Math.round((max * parts[1]) / parts[0])) }
    }
    return { width: Math.max(6, Math.round((max * parts[0]) / parts[1])), height: max }
  }

  return { width: 12, height: 12 }
}

export type ImageDialogueAspectRatioOption = {
  key: string
  label: string
  preview: { width: number; height: number }
}

export type ImageDialogueModelEntry = {
  key: string
  label: string
  icon?: string
  desc?: string
  badge?: string
  ratios: string[]
  resolutions: string[]
  countOptions: number[]
}

function parseImageModelResolutions(value: unknown): string[] {
  if (Array.isArray(value)) {
    const result: string[] = []
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) {
        result.push(item.trim())
        continue
      }
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const rawValue = row.value ?? row.key ?? row.label
      const valueText = typeof rawValue === 'string' ? rawValue.trim() : ''
      if (!valueText) continue
      result.push(valueText)
    }
    return result
  }

  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>
    const options = row.options ?? row.values ?? row.items ?? row.list
    if (options) return parseImageModelResolutions(options)
  }

  return []
}

function buildImageCapabilityFallbackEntry(capability: ImageCapability | null) {
  const ratios = parseCapabilityStringArray(
    capability?.parameters?.ratio ??
      capability?.parameters?.aspectRatio ??
      capability?.parameters?.aspectRatios,
  )
  const resolutions = parseImageModelResolutions(capability?.parameters?.resolution)
  const countOptions = parseCapabilityCountRange(capability?.parameters)
  return { ratios, resolutions, countOptions }
}

function parseImageCapabilityModelEntry(
  item: unknown,
  fallback: {
    ratios: string[]
    resolutions: string[]
    countOptions: number[]
  },
): ImageDialogueModelEntry | null {
  if (!item || typeof item !== 'object') return null
  const row = item as Record<string, unknown>
  const rawValue = row.value ?? row.key ?? row.id ?? row.model
  const value = typeof rawValue === 'string' ? rawValue.trim() : ''
  if (!value) return null
  const rawLabel = row.label ?? row.name ?? row.title
  const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : value

  const ratios = parseCapabilityStringArray(
    row.ratio ?? row.ratios ?? row.aspectRatio ?? row.aspectRatios,
  )
  const resolutions = parseImageModelResolutions(row.resolution)
  const countOptions = parseCapabilityCountRange({ count: row.count })
  const icon = normalizeDialogueModelIcon(typeof row.icon === 'string' ? row.icon : '')
  const desc =
    typeof row.desc === 'string'
      ? row.desc
      : typeof row.description === 'string'
        ? row.description
        : undefined
  const badge =
    typeof row.badge === 'string'
      ? row.badge
      : typeof row.tag === 'string'
        ? row.tag
        : undefined

  return {
    key: value,
    label,
    ...(icon ? { icon } : {}),
    ...(desc ? { desc } : {}),
    ...(badge ? { badge } : {}),
    ratios: ratios.length ? ratios : fallback.ratios,
    resolutions: resolutions.length ? resolutions : fallback.resolutions,
    countOptions: countOptions.length ? countOptions : fallback.countOptions,
  }
}

/** 解析 chatTools.image.parameters.models */
export function listImageDialogueModelEntries(
  source: ImageDialogueSource,
): ImageDialogueModelEntry[] {
  const capability = findImageDialogueSource(source)
  if (!capability?.parameters) return []

  const fallback = buildImageCapabilityFallbackEntry(capability)
  const models = capability.parameters.models
  if (Array.isArray(models) && models.length) {
    return models
      .map((item) => parseImageCapabilityModelEntry(item, fallback))
      .filter((item): item is ImageDialogueModelEntry => Boolean(item))
  }

  const modelOptions = parseCapabilityModelOptions(capability.parameters.modelOptions)
  if (modelOptions.length) {
    return modelOptions.map((item) => ({
      key: item.value,
      label: item.label,
      ...(item.icon ? { icon: normalizeDialogueModelIcon(item.icon) } : {}),
      ...(item.desc ? { desc: item.desc } : {}),
      ...(item.badge ? { badge: item.badge } : {}),
      ...fallback,
    }))
  }

  const legacyModels = parseCapabilityStringArray(capability.parameters.model)
  if (legacyModels.length) {
    return legacyModels.map((key) => ({
      key,
      label: key,
      ...fallback,
    }))
  }

  return []
}

export function findImageDialogueModelEntry(
  source: ImageDialogueSource,
  modelKey?: string | null,
): ImageDialogueModelEntry | null {
  const entries = listImageDialogueModelEntries(source)
  if (!entries.length) return null
  const preferred = modelKey?.trim()
  if (preferred) {
    const matched = entries.find((entry) => entry.key === preferred)
    if (matched) return matched
  }
  return entries[0] ?? null
}

export function buildImageDialogueAspectRatiosFromCapabilities(
  source: ImageDialogueSource,
  modelKey?: string | null,
): ImageDialogueAspectRatioOption[] {
  const entry = findImageDialogueModelEntry(source, modelKey)
  const ratios = entry?.ratios ?? []
  if (!ratios.length) {
    const capability = findImageDialogueSource(source)
    const legacyRatios = parseCapabilityStringArray(capability?.parameters?.aspectRatio)
    if (legacyRatios.length) {
      return legacyRatios.map((ratio) => ({
        key: ratio,
        label: ratio,
        preview: resolveAspectRatioPreview(ratio),
      }))
    }
    return IMAGE_GEN_ASPECT_RATIOS.map((item) => ({
      key: item.key,
      label: item.label,
      preview: item.preview,
    }))
  }
  return ratios.map((ratio) => ({
    key: ratio,
    label: ratio === 'auto' ? 'auto' : ratio,
    preview: resolveAspectRatioPreview(ratio),
  }))
}

export function buildImageDialogueResolutionsFromCapabilities(
  source: ImageDialogueSource,
  modelKey?: string | null,
): string[] {
  const entry = findImageDialogueModelEntry(source, modelKey)
  if (entry?.resolutions.length) return entry.resolutions

  const capability = findImageDialogueSource(source)
  const resolutions = parseImageModelResolutions(capability?.parameters?.resolution)
  if (resolutions.length) return resolutions
  return IMAGE_DESIGN_IPS_MENU.map((item) => item.label)
}

export function buildImageDialogueModelsFromCapabilities(
  source: ImageDialogueSource,
): ImageDialogueModelItem[] {
  const entries = listImageDialogueModelEntries(source)
  if (entries.length) {
    return entries.map((item, index) => ({
      key: item.key,
      name: item.label,
      duration: '',
      icon: resolveImageDialogueModelItemIcon(item.icon, item.key || item.label, index),
      ...(item.desc ? { desc: item.desc } : {}),
      ...(item.badge ? { badge: item.badge } : {}),
    }))
  }

  return IMAGE_DIALOGUE_MODEL_MENU
}

export function buildImageDialogueCountOptionsFromCapabilities(
  source: ImageDialogueSource,
  modelKey?: string | null,
): number[] {
  const entry = findImageDialogueModelEntry(source, modelKey)
  if (entry?.countOptions.length) return entry.countOptions

  const capability = findImageDialogueSource(source)
  const fromApi = parseCapabilityCountRange(capability?.parameters)
  if (fromApi.length) return fromApi
  return [...IMAGE_DIALOGUE_COUNT_OPTIONS]
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
    { key: 'panorama', label: '全景', badge: 'NEW' },
    { key: 'multi-angle', label: '多角度' },
    { key: 'lighting', label: '打光' },
    { key: 'grid', label: '九宫格' },
    { key: 'hd', label: '高清' },
    { key: 'grid-split', label: '宫格切分' },
  ],
  icons: [
    { key: 'rotate', label: '旋转', icon: 'rotate' },
    { key: 'flip', label: '翻转', icon: 'flip' },
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

export type ImageContextMenuIcon =
  | 'send-model'
  | 'layer-top'
  | 'layer-bottom'
  | 'data-advisor'
  | 'parse'
  | 'icon-duihuaqipao'
  | 'send-agent'
  | 'preview'
  | 'download'
  | 'lock'
  | 'copy-image'
  | 'save'
  | 'delete'
  | 'icon-contact-customer-service'
  | 'icon-xiazai'
  | 'icon-yulan1'
  | 'icon-shanchu'
  | 'icon-baocun1'
  | 'icon-geren'

export type ImageContextMenuItem = {
  key: string
  label: string
  icon: ImageContextMenuIcon
  danger?: boolean
}

/** 图片节点右键菜单分组 */
export const IMAGE_CONTEXT_MENU_SECTIONS: ImageContextMenuItem[][] = [
  [
    { key: 'chat', label: '对话', icon: 'icon-duihuaqipao' },
    { key: 'send-agent', label: '添加到智能体', icon: 'icon-contact-customer-service' },
    { key: 'send-model', label: '添加到我的模特', icon: 'icon-geren' },
  ],
  [
    { key: 'preview', label: '预览', icon: 'icon-yulan1' },
    { key: 'download', label: '下载', icon: 'icon-xiazai' },
    // { key: 'copy-image', label: '复制图片', icon: 'copy-image' },
  ],
  [
    { key: 'save', label: '保存', icon: 'icon-baocun1' },
    { key: 'delete', label: '删除', icon: 'icon-shanchu', danger: true },
  ],
]

/** 视频节点右键菜单分组（与图片节点结构一致） */
export const VIDEO_CONTEXT_MENU_SECTIONS: ImageContextMenuItem[][] = [
  [
    { key: 'chat', label: '对话', icon: 'icon-duihuaqipao' },
    { key: 'send-agent', label: '添加到智能体', icon: 'icon-contact-customer-service' },
  ],
  [
    { key: 'preview', label: '预览', icon: 'icon-yulan1' },
    { key: 'download', label: '下载', icon: 'icon-xiazai' },
    // { key: 'copy-video', label: '复制视频', icon: 'copy-image' },
  ],
  [
    { key: 'save', label: '保存', icon: 'icon-baocun1' },
    { key: 'delete', label: '删除', icon: 'icon-shanchu', danger: true },
  ],
]

export type MediaContextMenuKind = 'image' | 'video'

export function getMediaContextMenuSections(kind: MediaContextMenuKind) {
  return kind === 'video' ? VIDEO_CONTEXT_MENU_SECTIONS : IMAGE_CONTEXT_MENU_SECTIONS
}

export const IMAGE_DIALOGUE_GREETING = 'Hi, 我是你的AI设计助理'
export const IMAGE_DIALOGUE_PLACEHOLDER =
  '可直接文字生图，或上传图片输入文字指令对图片进行编辑，如：将背景改为雪夜'
export const IMAGE_DIALOGUE_MODEL_LABEL = 'Lib Image'
export const IMAGE_DIALOGUE_QUALITY_LABEL = '自适应 · 标准画质 · 2K'
export const IMAGE_DIALOGUE_CREDITS = '22'
export const GROUP_EXECUTE_IMG2PROMPT_CREDITS = 6
export const GROUP_EXECUTE_TEXT_COPY_CREDITS = 6
export const IMAGE_DIALOGUE_COUNT_OPTIONS = [1, 2, 4] as const

export const IMAGE_STYLE_PANEL_SEARCH_PLACEHOLDER = '搜索想要的风格、灵感、视觉'
export const IMAGE_STYLE_PANEL_TABS = [
  '推荐',
  '摄影写真',
  '电商营销',
  '动漫游戏',
  '风格插画',
  '平面设计',
  '建筑及室内设计',
  '故事玩法',
  '大片玩法',
  '小说漫文',
] as const

export type ImageStyleCard = {
  key: string
  title: string
  author: string
  gradient: string
  credits: number
}

const IMAGE_STYLE_CARD_TITLES = [
  '光感水彩',
  '创意3D渲染卡通世界',
  '数字护理设计',
  '3D渲染户型彩屏',
  '电商保护形象插画',
  '室内场景纯真装饰',
  '极简几何商品台',
  '钢笔线条画风',
  '室内温暖家居置景',
  '气泡球珠质感风',
  '梦幻3D色彩画风',
  '团扇工笔画面',
  '产品摄影暗调光',
  '游戏场景设计',
  'Q版手绘画风',
  '果冻质感设计',
  '毛绒玩偶商务系',
  '电影感产品场景',
  '3D机械科技风',
  '国风手绘卡通玩偶',
  '蜡笔风卡通头像',
  '蜡笔水彩涂鸦插画',
  '软萌漫画设计',
  '霓虹赛博城市',
]

const IMAGE_STYLE_CARD_AUTHORS = ['蜜全岁月', '智子归依', '像素ADESIGN', '微缩造物']

const IMAGE_STYLE_CARD_GRADIENTS = [
  'linear-gradient(135deg, #d6f5c8 0%, #8fd06a 100%)',
  'linear-gradient(135deg, #fde2c8 0%, #f7b267 100%)',
  'linear-gradient(135deg, #cfe3ff 0%, #7aa8f5 100%)',
  'linear-gradient(135deg, #e7d6ff 0%, #b18bf0 100%)',
  'linear-gradient(135deg, #ffd6e7 0%, #f48fb1 100%)',
  'linear-gradient(135deg, #d2f4f0 0%, #7fd6c7 100%)',
  'linear-gradient(135deg, #fff3c4 0%, #f6c453 100%)',
  'linear-gradient(135deg, #e3e7ec 0%, #aab4c4 100%)',
]

export const IMAGE_STYLE_PANEL_CARDS: ImageStyleCard[] = IMAGE_STYLE_CARD_TITLES.map(
  (title, index) => ({
    key: `style-${index}`,
    title,
    author: IMAGE_STYLE_CARD_AUTHORS[index % IMAGE_STYLE_CARD_AUTHORS.length],
    gradient: IMAGE_STYLE_CARD_GRADIENTS[index % IMAGE_STYLE_CARD_GRADIENTS.length],
    credits: 300 + ((index * 137) % 900),
  }),
)

export type ImageDialogueModelIcon = 'lib' | 'navo' | 'seedream' | 'mj'

export type ImageDialogueModelItem = {
  key: string
  name: string
  duration: string
  icon: ImageDialogueModelIcon | string
  desc?: string
  badge?: string
}

export const IMAGE_DIALOGUE_MODEL_MENU: ImageDialogueModelItem[] = [
  { key: 'lib-image', name: 'Lib Image', duration: '60s', icon: 'lib', desc: '最新图片模型、长文本能力突出' },
  { key: 'lib-navo-pro', name: 'Lib Navo Pro', duration: '50s', icon: 'navo' },
  { key: 'lib-navo-2', name: 'Lib Navo 2', duration: '25s', icon: 'navo' },
  { key: 'seedream-4-6', name: 'Seedream 4.6', duration: '20s', icon: 'seedream' },
  { key: 'seedream-5-lite', name: 'Seedream 5.0 Lite', duration: '20s', icon: 'seedream' },
  { key: 'seedream-4-5', name: 'Seedream 4.5', duration: '15s', icon: 'seedream', badge: '限时5折' },
  { key: 'midjourney-v7', name: 'Midjourney V7', duration: '50s', icon: 'mj' },
]

export function createDefaultImageDialogueSettings(
  source?: ImageDialogueSource,
): ImageDialogueSettings {
  return normalizeImageDialogueSettingsForModel({}, source)
}

/** 仅保留用户已填写的图片对话设置字段，空值交给 normalize 取列表第一项 */
export function pickImageDialogueSettingsInput(
  partial: Partial<ImageDialogueSettings> | undefined,
): Partial<ImageDialogueSettings> {
  if (!partial) return {}
  const input: Partial<ImageDialogueSettings> = {}
  if (partial.modelKey?.trim()) input.modelKey = partial.modelKey.trim()
  if (partial.workflowId?.trim()) input.workflowId = partial.workflowId.trim()
  if (partial.aspectRatio?.trim()) input.aspectRatio = partial.aspectRatio.trim()
  if (partial.resolution?.trim()) input.resolution = partial.resolution.trim()
  if (partial.imageCount != null && Number.isFinite(partial.imageCount) && partial.imageCount > 0) {
    input.imageCount = Math.floor(partial.imageCount)
  }
  return input
}

/** 将 modelKey 规范为 models[].value；兼容误存 label 的场景 */
export function resolveImageDialogueModelKey(
  preferred: string | undefined | null,
  source?: ImageDialogueSource,
): string {
  return resolveImageDialogueModelApiValue(preferred, source)
}

/** 提交图片生成任务时使用的模型值（models[].value） */
export function resolveImageDialogueModelApiValue(
  preferred: string | undefined | null,
  source?: ImageDialogueSource,
): string {
  const entries = listImageDialogueModelEntries(source)
  if (!entries.length) {
    return preferred?.trim() || IMAGE_DIALOGUE_MODEL_MENU[0].key
  }
  const text = preferred?.trim() ?? ''
  if (text) {
    const byValue = entries.find((entry) => entry.key === text)
    if (byValue) return byValue.key
    const lower = text.toLowerCase()
    const byLabel = entries.find(
      (entry) => entry.label === text || entry.label.toLowerCase() === lower,
    )
    if (byLabel) return byLabel.key
  }
  return entries[0].key
}

/** 按当前模型收敛宽高比 / 分辨率 / 张数等参数 */
export function normalizeImageDialogueSettingsForModel(
  partial: Partial<ImageDialogueSettings>,
  source?: ImageDialogueSource,
): ImageDialogueSettings {
  const modelKey = resolveImageDialogueModelKey(partial.modelKey, source)
  const ratios = buildImageDialogueAspectRatiosFromCapabilities(source, modelKey)
  const resolutions = buildImageDialogueResolutionsFromCapabilities(source, modelKey)
  const counts = buildImageDialogueCountOptionsFromCapabilities(source, modelKey)

  const defaultAspectRatio = ratios[0]?.key ?? 'auto'
  const defaultResolution = resolutions[0] ?? '1K'
  const defaultImageCount = counts[0] ?? 1

  let aspectRatio = partial.aspectRatio?.trim() ? partial.aspectRatio : defaultAspectRatio
  if (!ratios.some((ratio) => ratio.key === aspectRatio)) {
    aspectRatio = defaultAspectRatio
  }

  let resolution = partial.resolution?.trim() ? partial.resolution : defaultResolution
  if (!resolutions.includes(resolution)) {
    resolution = defaultResolution
  }

  let imageCount = partial.imageCount ?? defaultImageCount
  if (counts.length && !counts.includes(imageCount)) {
    imageCount = defaultImageCount
  }

  return {
    modelKey,
    aspectRatio,
    resolution,
    imageCount,
    workflowId: partial.workflowId ?? '',
  }
}

export const IMAGE_COLOR_DEFAULT = '#0E316A'
export const IMAGE_COLOR_SWATCHES = [
  '#9CA3AF',
  '#6B7280',
  '#374151',
  '#F97316',
  '#FBBF24',
  '#FDE047',
  '#3B82F6',
  '#0E316A',
  '#7C3AED',
  '#A855F7',
  '#22C55E',
  '#EF4444',
] as const
export const IMAGE_COLOR_PALETTE_PRESETS = [
  { key: 'default', label: '默认' },
  { key: 'warm', label: '暖色' },
  { key: 'cool', label: '冷色' },
  { key: 'mono', label: '单色' },
] as const

export const IMAGE_GEN_ASPECT_RATIO_LABEL = '宽高比'
export const IMAGE_GEN_ASPECT_RATIO_QUALITY_LABEL = '清晰度'
export const IMAGE_GEN_COUNT_LABEL = '张数'
export const IMAGE_GEN_ASPECT_RATIOS = [
  { key: 'auto', label: 'auto', preview: { width: 14, height: 10 } },
  { key: '3:4', label: '3:4', preview: { width: 10, height: 14 } },
  { key: '1:1', label: '1:1', preview: { width: 12, height: 12 } },
  { key: '16:9', label: '16:9', preview: { width: 16, height: 9 } },
  { key: '9:16', label: '9:16', preview: { width: 9, height: 16 } },
  { key: '4:3', label: '4:3', preview: { width: 14, height: 10 } },
  { key: '3:2', label: '3:2', preview: { width: 15, height: 10 } },
  { key: '2:3', label: '2:3', preview: { width: 10, height: 15 } },
  { key: '4:5', label: '4:5', preview: { width: 10, height: 12 } },
  { key: '5:4', label: '5:4', preview: { width: 12, height: 10 } },
  { key: '21:9', label: '21:9', preview: { width: 18, height: 8 } },
] as const
export type ImageGenAspectRatio = (typeof IMAGE_GEN_ASPECT_RATIOS)[number]['key']
export const IMAGE_GEN_COUNTS = [1, 2, 3] as const
export type ImageGenCount = (typeof IMAGE_GEN_COUNTS)[number]

export const IMAGE_DESIGN_IPS_TITLE = '分辨率';
export const IMAGE_DESIGN_IPS_MENU = [
  {
    key: '1K',
    label: '1K',
  },
  {
    key: '2K',
    label: '2K',
  },
  {
    key: '4K',
    label: '4K',
  },
] as const

export const IMAGE_DESIGN_ADVISOR_TITLE = '设计灵感'
export const IMAGE_DESIGN_ADVISOR_MENU = [
  {
    key: 'idea',
    label: '设计思路',
    children: [
      { key: 'concept', label: '灵感发散', prompt: '请根据图片分析设计灵感，给出可落地的创意方向' },
      { key: 'style', label: '风格定位', prompt: '请根据图片提炼整体风格，并说明适用场景与人群' },
      { key: 'color', label: '配色建议', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
    ],
  },
  {
    key: 'product-shot',
    label: '商品实拍',
    children: [
      { key: '3d', label: '服装立体3D图', prompt: '请生成服装立体3D展示图，突出版型与立体感' },
      { key: 'flat', label: '服装平铺图', prompt: '请生成服装平铺展示图，背景干净、构图规整' },
      { key: 'detail', label: '服装细节图', prompt: '请生成服装细节特写图，突出工艺与材质纹理' },
      { key: 'fabric', label: '服装面料图', prompt: '请生成服装面料质感展示图，强调织物纹理与光泽' },
      { key: '360', label: '商品360°', prompt: '请生成商品360°展示方案，覆盖多角度呈现需求' },
    ],
  },
  {
    key: 'product-match',
    label: '商品搭配',
    children: [
      { key: 'outfit', label: '整套搭配', prompt: '请根据图片给出整套穿搭搭配方案' },
      { key: 'accessory', label: '配饰组合', prompt: '请推荐与图片商品协调的配饰组合' },
      { key: 'display', label: '场景陈列', prompt: '请给出商品场景化陈列与布景建议' },
    ],
  },
  {
    key: 'model-pose',
    label: '模特姿态',
    children: [
      { key: 'standing', label: '站姿展示', prompt: '请推荐适合该商品的模特站姿与肢体表现' },
      { key: 'walking', label: '走步动态', prompt: '请推荐走步动态姿势，突出服装垂坠与动感' },
      { key: 'closeup', label: '半身特写', prompt: '请推荐半身特写姿态，突出上身版型与细节' },
    ],
  },
  {
    key: 'model-tryon',
    label: '模特试穿',
    children: [
      { key: 'fit', label: '合身效果', prompt: '请生成模特试穿合身效果展示方案' },
      { key: 'layer', label: '叠穿展示', prompt: '请生成模特叠穿试穿效果展示方案' },
      { key: 'compare', label: '尺码对比', prompt: '请给出不同尺码试穿对比展示建议' },
    ],
  },
  {
    key: 'digital-model',
    label: '数字人模特',
    children: [
      { key: 'avatar', label: '虚拟形象', prompt: '请推荐适合该商品的数字人虚拟形象设定' },
      { key: 'motion', label: '动作演绎', prompt: '请设计数字人模特动作演绎脚本' },
      { key: 'scene', label: '场景融合', prompt: '请给出数字人模特与商品场景融合方案' },
    ],
  },
] as const

export const IMAGE_DESIGN_WORKFLOW_TITLE = '工作流'
export const IMAGE_DESIGN_WORKFLOW_MENU = [
  {
    key: 'idea',
    label: '商品实拍',
    children: [
      { key: '3d', label: '服装立体3D图', prompt: '请根据图片分析设计灵感，给出可落地的创意方向' },
      { key: 'flat', label: '服装平铺图', prompt: '请根据图片提炼整体风格，并说明适用场景与人群' },
      { key: 'detail', label: '服装细节图', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
      { key: 'fabric', label: '服装面料图', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
      { key: '360', label: '商品360°', prompt: '请生成商品360°展示方案，覆盖多角度呈现需求' },
    ],
  },
  {
    key: 'product-caption',
    label: '种草图',
    children: [
      { key: 'concept', label: '服装立体3D图', prompt: '请根据图片分析设计灵感，给出可落地的创意方向' },
      { key: 'color', label: '服装细节图', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
      { key: 'color', label: '服装面料图', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
      { key: 'color', label: '详情页图', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
    ],
  },
  {
    key: 'model-pose',
    label: '模特姿势',
    children: [
      { key: 'front', label: '正面全身', prompt: '请根据图片分析设计灵感，给出可落地的创意方向' },
      { key: 'back', label: '背面全身', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
      { key: 'color', label: '侧面45度', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
      { key: 'random', label: '随机姿势', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
    ],
  },
  {
    key: 'model-tryon',
    label: '模特试穿',
    children: [
      { key: 'female', label: '随机女性', prompt: '请根据图片分析设计灵感，给出可落地的创意方向' },
      { key: 'male', label: '随机男性', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
      { key: 'child', label: '随机童模', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
      { key: 'my', label: '我的模特', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
    ],
  },
  {
    key: 'digital-model',
    label: '数字人模特',
    children: [
      { key: 'female', label: '图生数字人', prompt: '请根据图片分析设计灵感，给出可落地的创意方向' },
      { key: 'face', label: '模特换脸', prompt: '请根据图片给出主色、辅色与点缀色搭配建议' },
    ],
  },
] as const

export type CanvasProjectItem = {
  id: string
  name: string
  saved: boolean
}

export const CANVAS_PROJECTS: CanvasProjectItem[] = [
  { id: 'draft-1', name: '未命名创作', saved: true },
  { id: 'draft-2', name: '未命名创作1', saved: false },
]

export const VIDEO_DIALOGUE_GREETING = 'Hi, 我是你的AI设计助理'
export const VIDEO_DIALOGUE_PLACEHOLDER = '让我们开始创作吧...'
export const VIDEO_DIALOGUE_VIDEO_SETTINGS = '5s · 16:9 · 720P'
export const VIDEO_DIALOGUE_CREDITS = '135'

export const VIDEO_GEN_DURATION_LABEL = '视频时长'
export const VIDEO_GEN_ASPECT_RATIO_LABEL = '比例'
export const VIDEO_GEN_RESOLUTION_LABEL = '清晰度'
export const VIDEO_GEN_AUDIO_LABEL = '生成音频'
export const VIDEO_GEN_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const
export type VideoGenDuration = (typeof VIDEO_GEN_DURATIONS)[number]
export const VIDEO_GEN_ASPECT_RATIOS = [
  { key: 'auto', label: 'Auto', preview: { width: 14, height: 14 } },
  { key: '16:9', label: '16:9', preview: { width: 16, height: 9 } },
  { key: '4:3', label: '4:3', preview: { width: 14, height: 10 } },
  { key: '1:1', label: '1:1', preview: { width: 12, height: 12 } },
  { key: '3:4', label: '3:4', preview: { width: 10, height: 14 } },
  { key: '9:16', label: '9:16', preview: { width: 9, height: 16 } },
  { key: '21:9', label: '21:9', preview: { width: 18, height: 8 } },
] as const
export type VideoGenAspectRatio = (typeof VIDEO_GEN_ASPECT_RATIOS)[number]['key']
export const VIDEO_GEN_RESOLUTIONS = ['480P', '720P', '1080P'] as const
export type VideoGenResolution = (typeof VIDEO_GEN_RESOLUTIONS)[number]

export function formatVideoGenSettings(
  duration: VideoGenDuration,
  aspectRatio: VideoGenAspectRatio,
  resolution: VideoGenResolution,
) {
  const ratioLabel = aspectRatio === 'auto' ? 'Auto' : aspectRatio
  return `${ratioLabel} · ${resolution} · ${duration}s`
}

export const VIDEO_GENERAL_CAPABILITY_CODE = 'VIDEO_GENERAL_V1'

/** 视频节点是否处于视频生成任务进行中 */
export function isVideoNodeGenerating(data: CanvasNodeData | undefined): boolean {
  if (!data || data.kind !== 'video') return false
  return (
    data.uploadState === 'uploading' &&
    (data.generationTaskType === 'VIDEO' || Boolean(String(data.generationTaskId ?? '').trim()))
  )
}

export type VideoDialogueSource = ImageDialogueSource

/** 解析视频对话面板数据源：优先 chatTools.video */
export function findVideoDialogueSource(source: VideoDialogueSource): ImageCapability | null {
  if (!source || typeof source !== 'object') return null

  if ('data' in source) {
    const data = (source as { data?: unknown }).data
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const capability = findVideoDialogueSource(data as VideoDialogueSource)
      if (capability) return capability
    }
  }

  if ('video' in source) {
    const video = (source as ChatTools).video
    if (video && typeof video === 'object') return video
  }

  if ('parameters' in source && ('code' in source || 'nodeType' in source)) {
    const capability = source as ImageCapability
    if (capability.nodeType === 'VIDEO' || capability.code?.includes('VIDEO')) {
      return capability
    }
  }

  const list = normalizeImageCapabilities(source)
  return (
    list.find((item) => item.code === VIDEO_GENERAL_CAPABILITY_CODE) ??
    list.find((item) => item.nodeType === 'VIDEO' || item.code?.includes('VIDEO')) ??
    null
  )
}

export type VideoDialogueResolutionOption = {
  label: string
  key: string
  apiValue: string
}

export type VideoDialogueModelEntry = {
  key: string
  label: string
  icon?: string
  duration: VideoDialogueDurationRange
  ratios: string[]
  resolutions: VideoDialogueResolutionOption[]
  generateAudio: boolean[]
  countOptions: number[]
}

function parseVideoModelDuration(value: unknown): VideoDialogueDurationRange {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const range = value as { min?: number; max?: number; default?: number }
    const min = Math.max(1, Math.floor(Number(range.min) || VIDEO_GEN_DURATIONS[0]))
    const max = Math.max(
      min,
      Math.floor(Number(range.max) || VIDEO_GEN_DURATIONS[VIDEO_GEN_DURATIONS.length - 1]),
    )
    const defaultValue = Number.isFinite(Number(range.default))
      ? Math.min(max, Math.max(min, Math.floor(Number(range.default))))
      : undefined
    return { min, max, defaultValue }
  }
  return {
    min: VIDEO_GEN_DURATIONS[0],
    max: VIDEO_GEN_DURATIONS[VIDEO_GEN_DURATIONS.length - 1],
  }
}

function parseVideoModelResolutions(value: unknown): VideoDialogueResolutionOption[] {
  if (!Array.isArray(value)) return []

  const result: VideoDialogueResolutionOption[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      const key = normalizeVideoClarityLabel(item)
      result.push({
        label: key,
        key,
        apiValue: toVideoApiClarity(item),
      })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const rawValue = row.value ?? row.key ?? row.label
    const valueText = typeof rawValue === 'string' ? rawValue.trim() : ''
    if (!valueText) continue
    const rawLabel = row.label ?? valueText
    const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : valueText
    const key = normalizeVideoClarityLabel(valueText)
    result.push({
      label,
      key,
      apiValue: toVideoApiClarity(valueText),
    })
  }
  return result
}

function parseVideoCapabilityModelEntry(
  item: unknown,
  fallback: {
    duration: VideoDialogueDurationRange
    ratios: string[]
    resolutions: VideoDialogueResolutionOption[]
    generateAudio: boolean[]
    countOptions: number[]
  },
): VideoDialogueModelEntry | null {
  if (!item || typeof item !== 'object') return null
  const row = item as Record<string, unknown>
  const rawValue = row.value ?? row.key ?? row.id ?? row.model
  const value = typeof rawValue === 'string' ? rawValue.trim() : ''
  if (!value) return null
  const rawLabel = row.label ?? row.name ?? row.title
  const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : value

  const ratios = parseCapabilityStringArray(
    row.ratio ?? row.ratios ?? row.aspectRatio ?? row.aspectRatios,
  )
  const resolutions = parseVideoModelResolutions(row.resolution ?? row.clarity)
  const duration = parseVideoModelDuration(row.duration)
  const generateAudio = Array.isArray(row.generateAudio)
    ? row.generateAudio.filter((option): option is boolean => typeof option === 'boolean')
    : fallback.generateAudio
  const countOptions = parseCapabilityCountRange({
    count: row.videoCount ?? row.count,
  })
  const icon = normalizeDialogueModelIcon(typeof row.icon === 'string' ? row.icon : '')

  return {
    key: value,
    label,
    ...(icon ? { icon } : {}),
    duration: row.duration ? duration : fallback.duration,
    ratios: ratios.length ? ratios : fallback.ratios,
    resolutions: resolutions.length ? resolutions : fallback.resolutions,
    generateAudio: generateAudio.length ? generateAudio : fallback.generateAudio,
    countOptions: countOptions.length ? countOptions : fallback.countOptions,
  }
}

function buildVideoCapabilityFallbackEntry(
  capability: ImageCapability | null,
): Omit<VideoDialogueModelEntry, 'key' | 'label'> {
  const ratios = parseCapabilityStringArray(
    capability?.parameters?.ratio ??
      capability?.parameters?.ratios ??
      capability?.parameters?.aspectRatio,
  )
  const resolutions = parseVideoModelResolutions(
    capability?.parameters?.resolution ?? capability?.parameters?.clarity,
  )
  const generateAudio = Array.isArray(capability?.parameters?.generateAudio)
    ? capability.parameters.generateAudio.filter(
        (option): option is boolean => typeof option === 'boolean',
      )
    : [true, false]

  return {
    duration: parseVideoModelDuration(capability?.parameters?.duration),
    ratios,
    resolutions,
    generateAudio: generateAudio.length ? generateAudio : [true, false],
    countOptions: parseCapabilityCountRange(capability?.parameters),
  }
}

/** 解析 chatTools.video.parameters.models */
export function listVideoDialogueModelEntries(
  source: VideoDialogueSource,
): VideoDialogueModelEntry[] {
  const capability = findVideoDialogueSource(source)
  if (!capability?.parameters) return []

  const fallback = buildVideoCapabilityFallbackEntry(capability)
  const models = capability.parameters.models
  if (Array.isArray(models) && models.length) {
    return models
      .map((item) => parseVideoCapabilityModelEntry(item, fallback))
      .filter((item): item is VideoDialogueModelEntry => Boolean(item))
  }

  const modelOptions = parseCapabilityModelOptions(capability.parameters.modelOptions)
  if (modelOptions.length) {
    return modelOptions.map((item) => ({
      key: item.value,
      label: item.label,
      ...(item.icon ? { icon: normalizeDialogueModelIcon(item.icon) } : {}),
      ...fallback,
    }))
  }

  const legacyModels = parseCapabilityStringArray(capability.parameters.model)
  if (legacyModels.length) {
    return legacyModels.map((key) => ({
      key,
      label: key,
      ...fallback,
    }))
  }

  return []
}

export function findVideoDialogueModelEntry(
  source: VideoDialogueSource,
  modelKey?: string | null,
): VideoDialogueModelEntry | null {
  const entries = listVideoDialogueModelEntries(source)
  if (!entries.length) return null
  const preferred = modelKey?.trim()
  if (preferred) {
    const matched = entries.find((entry) => entry.key === preferred)
    if (matched) return matched
  }
  return entries[0] ?? null
}

export function normalizeVideoClarityLabel(value: string): string {
  const match = value.trim().match(/^(\d+)\s*p$/i)
  if (match) return `${match[1]}P`
  return value.trim().toUpperCase()
}

/** 接口文档要求 clarity 形如 1080p */
export function toVideoApiClarity(value: string): string {
  const match = value.trim().match(/^(\d+)\s*p$/i)
  if (match) return `${match[1]}p`
  return value.trim().toLowerCase()
}

export function buildVideoDialogueAspectRatiosFromCapabilities(
  source: VideoDialogueSource,
  modelKey?: string | null,
): ImageDialogueAspectRatioOption[] {
  const entry = findVideoDialogueModelEntry(source, modelKey)
  const ratios = entry?.ratios ?? []
  if (!ratios.length) {
    return VIDEO_GEN_ASPECT_RATIOS.map((item) => ({
      key: item.key,
      label: item.label,
      preview: item.preview,
    }))
  }
  return ratios.map((ratio) => ({
    key: ratio,
    label: ratio === 'auto' ? 'Auto' : ratio,
    preview: resolveAspectRatioPreview(ratio),
  }))
}

export function buildVideoDialogueResolutionOptionsFromCapabilities(
  source: VideoDialogueSource,
  modelKey?: string | null,
): VideoDialogueResolutionOption[] {
  const entry = findVideoDialogueModelEntry(source, modelKey)
  if (entry?.resolutions.length) return entry.resolutions
  return [...VIDEO_GEN_RESOLUTIONS].map((item) => ({
    label: item,
    key: item,
    apiValue: toVideoApiClarity(item),
  }))
}

export function buildVideoDialogueClaritiesFromCapabilities(
  source: VideoDialogueSource,
  modelKey?: string | null,
): string[] {
  const options = buildVideoDialogueResolutionOptionsFromCapabilities(source, modelKey)
  if (options.length) return options.map((item) => item.key)
  return [...VIDEO_GEN_RESOLUTIONS]
}

export type VideoDialogueDurationRange = {
  min: number
  max: number
  defaultValue?: number
}

export function buildVideoDialogueDurationRangeFromCapabilities(
  source: VideoDialogueSource,
  modelKey?: string | null,
): VideoDialogueDurationRange {
  const entry = findVideoDialogueModelEntry(source, modelKey)
  if (entry) return entry.duration

  const capability = findVideoDialogueSource(source)
  return parseVideoModelDuration(capability?.parameters?.duration)
}

export function buildVideoDialogueGenerateAudioOptions(
  source: VideoDialogueSource,
  modelKey?: string | null,
): boolean[] {
  const entry = findVideoDialogueModelEntry(source, modelKey)
  if (entry?.generateAudio.length) return entry.generateAudio

  const capability = findVideoDialogueSource(source)
  const options = capability?.parameters?.generateAudio
  if (Array.isArray(options)) {
    return options.filter((item): item is boolean => typeof item === 'boolean')
  }
  return [true, false]
}

export type VideoDialogueModelIcon = 'lib' | 'seedream' | 'seedance' | 'kling' | 'happy-horse' | 'wan'

export type VideoDialogueModelItem = {
  key: string
  name: string
  icon: VideoDialogueModelIcon | string
}

export const VIDEO_DIALOGUE_MODEL_MENU: VideoDialogueModelItem[] = [
  { key: 'seedance-2.0', name: 'seedance-2.0', icon: 'seedance' },
  { key: 'happy-horse-1.0', name: 'happy-horse-1.0', icon: 'happy-horse' },
  { key: 'kling-3.0', name: 'kling-3.0', icon: 'kling' },
]

export function createDefaultVideoDialogueSettings(
  source?: VideoDialogueSource,
): VideoDialogueSettings {
  const entries = listVideoDialogueModelEntries(source)
  const entry = entries[0] ?? null
  const modelKey = entry?.key ?? VIDEO_DIALOGUE_MODEL_MENU[0].key
  return normalizeVideoDialogueSettingsForModel({ modelKey }, source)
}

/** 将 modelKey 规范为 models[].value；兼容误存 label 的场景 */
export function resolveVideoDialogueModelKey(
  preferred: string | undefined | null,
  source?: VideoDialogueSource,
): string {
  return resolveVideoDialogueModelApiValue(preferred, source)
}

/** 提交视频生成任务时使用的模型值（models[].value） */
export function resolveVideoDialogueModelApiValue(
  preferred: string | undefined | null,
  source?: VideoDialogueSource,
): string {
  const entries = listVideoDialogueModelEntries(source)
  if (!entries.length) {
    return preferred?.trim() || VIDEO_DIALOGUE_MODEL_MENU[0].key
  }
  const text = preferred?.trim() ?? ''
  if (text) {
    const byValue = entries.find((entry) => entry.key === text)
    if (byValue) return byValue.key
    const lower = text.toLowerCase()
    const byLabel = entries.find(
      (entry) => entry.label === text || entry.label.toLowerCase() === lower,
    )
    if (byLabel) return byLabel.key
  }
  return entries[0].key
}

/** 按当前模型收敛比例 / 清晰度 / 时长 / 音频 / 数量等参数 */
export function normalizeVideoDialogueSettingsForModel(
  partial: Partial<VideoDialogueSettings>,
  source?: VideoDialogueSource,
): VideoDialogueSettings {
  const modelKey = resolveVideoDialogueModelKey(partial.modelKey, source)
  const ratios = buildVideoDialogueAspectRatiosFromCapabilities(source, modelKey)
  const clarities = buildVideoDialogueClaritiesFromCapabilities(source, modelKey)
  const durationRange = buildVideoDialogueDurationRangeFromCapabilities(source, modelKey)
  const audioOptions = buildVideoDialogueGenerateAudioOptions(source, modelKey)
  const counts = buildVideoDialogueCountOptionsFromCapabilities(source, modelKey)

  const defaultAspectRatio = (ratios[0]?.key ?? '16:9') as VideoGenAspectRatio
  const defaultResolution = (clarities[0] ?? '480P') as VideoGenResolution
  const defaultDuration = durationRange.min as VideoGenDuration
  const defaultGenerateAudio = audioOptions[0] ?? true
  const defaultVideoCount = counts[0] ?? 1

  let aspectRatio = partial.aspectRatio ?? defaultAspectRatio
  if (!ratios.some((ratio) => ratio.key === aspectRatio)) {
    aspectRatio = defaultAspectRatio
  }

  let resolution = partial.resolution ?? defaultResolution
  if (!clarities.includes(resolution)) {
    resolution = defaultResolution
  }

  let duration = partial.duration ?? defaultDuration
  const clampedDuration = Math.min(
    durationRange.max,
    Math.max(durationRange.min, Math.round(Number(duration) || durationRange.min)),
  )
  duration = clampedDuration as VideoGenDuration

  let generateAudio = partial.generateAudio ?? defaultGenerateAudio
  if (audioOptions.length && !audioOptions.includes(generateAudio)) {
    generateAudio = audioOptions[0]
  }

  let videoCount = partial.videoCount ?? defaultVideoCount
  if (counts.length && !counts.includes(videoCount)) {
    videoCount = defaultVideoCount
  }

  return {
    modelKey,
    aspectRatio,
    resolution,
    duration: duration as VideoGenDuration,
    generateAudio,
    videoCount,
    mode: partial.mode ?? 'reference',
  }
}

function resolveVideoDialogueModelIcon(key: string, index: number): VideoDialogueModelIcon {
  const lower = key.toLowerCase()
  if (lower.includes('seedance')) return 'seedance'
  if (lower.includes('kling')) return 'kling'
  if (lower.includes('happy') || lower.includes('horse')) return 'happy-horse'
  if (lower.includes('wan')) return 'wan'
  return index === 0 ? 'lib' : 'seedream'
}

function resolveVideoDialogueModelItemIcon(
  apiIcon: string | undefined,
  key: string,
  index: number,
): VideoDialogueModelIcon | string {
  const normalized = normalizeDialogueModelIcon(apiIcon)
  if (normalized) return normalized
  return resolveVideoDialogueModelIcon(key, index)
}

export function buildVideoDialogueCountOptionsFromCapabilities(
  source: VideoDialogueSource,
  modelKey?: string | null,
): number[] {
  const entry = findVideoDialogueModelEntry(source, modelKey)
  if (entry?.countOptions.length) return entry.countOptions

  const capability = findVideoDialogueSource(source)
  const fromApi = parseCapabilityCountRange(capability?.parameters)
  if (fromApi.length) return fromApi
  return [1, 2, 3]
}

export function buildVideoDialogueModelsFromCapabilities(
  source: VideoDialogueSource,
): VideoDialogueModelItem[] {
  const entries = listVideoDialogueModelEntries(source)
  if (!entries.length) return VIDEO_DIALOGUE_MODEL_MENU

  return entries.map((entry, index) => ({
    key: entry.key,
    name: entry.label,
    icon: resolveVideoDialogueModelItemIcon(entry.icon, entry.key || entry.label, index),
  }))
}

export type VideoGenModelId =
  | 'seedance-2-vip'
  | 'seedance-2-fast-vip'
  | 'happy-horse-1'
  | 'kling-03'
  | 'kling-3'
  | 'wan-2-7'
  | 'kling-01'

export type VideoGenModelItem = {
  id: VideoGenModelId
  name: string
  icon: 'seedance' | 'happy-horse' | 'kling' | 'wan'
  promoTag?: string
  description?: string
  duration: string
  vip?: boolean
  diamond?: boolean
}

export const VIDEO_GEN_MODELS: VideoGenModelItem[] = [
  {
    id: 'seedance-2-vip',
    name: 'Seedance 2.0 VIP',
    icon: 'seedance',
    promoTag: '720P限时9折',
    description: '最强视频模型，会员专属通道，15s 音画同步',
    duration: '2min',
    vip: true,
  },
  {
    id: 'seedance-2-fast-vip',
    name: 'Seedance 2.0 Fast VIP',
    icon: 'seedance',
    promoTag: '720P限时9折',
    duration: '2min',
    vip: true,
  },
  {
    id: 'happy-horse-1',
    name: 'Happy Horse 1.0',
    icon: 'happy-horse',
    promoTag: '限时4折',
    duration: '2min',
  },
  {
    id: 'kling-03',
    name: 'Kling 03',
    icon: 'kling',
    duration: '3min',
    diamond: true,
  },
  {
    id: 'kling-3',
    name: 'Kling 3.0',
    icon: 'kling',
    description: '最强视频模型，会员专属通道，15s 音画同步',
    duration: '3min',
    diamond: true,
  },
  {
    id: 'wan-2-7',
    name: 'Wan 2.7',
    icon: 'wan',
    duration: '3min',
  },
  {
    id: 'kling-01',
    name: 'Kling 01',
    icon: 'kling',
    duration: '3min',
    diamond: true,
  },
]

export const VIDEO_ADVISOR_MENU = [
  {
    key: 'dynamic',
    label: '动态呈现',
    children: [
      { key: 'product', label: '产品细节' },
      { key: 'tvc', label: 'TVC展示' },
      { key: 'fpv', label: 'FPV运镜' },
      { key: 'clothing', label: '服装展示' },
    ],
  },
  {
    key: 'voiceover',
    label: '口播配音',
    children: [
      { key: 'intro', label: '产品介绍' },
      { key: 'promo', label: '促销口播' },
      { key: 'story', label: '故事叙述' },
    ],
  },
  {
    key: 'camera',
    label: '运镜方式',
    children: [
      { key: 'push', label: '推镜头' },
      { key: 'orbit', label: '环绕运镜' },
      { key: 'follow', label: '跟随运镜' },
    ],
  },
] as const

export const VIDEO_STORYBOARD_TITLE = '生成分镜版图'
export const VIDEO_STORYBOARD_DURATION_LABEL = '视频时长'
export const VIDEO_STORYBOARD_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const
export type VideoStoryboardDuration = (typeof VIDEO_STORYBOARD_DURATIONS)[number]
export const VIDEO_STORYBOARD_DESC_LABEL = '补充描述（选填）'
export const VIDEO_STORYBOARD_DESC_PLACEHOLDER = '请输入分镜板视频补充要求...'
export const VIDEO_STORYBOARD_RATIOS = ['16:9', '9:16', '1:1'] as const
export type VideoStoryboardRatio = (typeof VIDEO_STORYBOARD_RATIOS)[number]

export const VIDEO_HD_TITLE = '视频高清'
export const VIDEO_HD_MAGNIFICATION_LABEL = '放大倍数'
export const VIDEO_HD_MAGNIFICATIONS = ['1', '2', '4'] as const
export type VideoHdMagnification = (typeof VIDEO_HD_MAGNIFICATIONS)[number]
export const VIDEO_HD_HINT =
  '预计消费较多积分(20积分每秒，约1元每秒)，10秒视频约请求耗时5分钟。'

export const IMAGE_HD_RESOLUTIONS = ['2K', '4K', '8K'] as const

export const IMAGE_CUTOUT_MODES = ['快速', '精准', '擦除'] as const

export const IMAGE_CROP_ASPECT_RATIOS = [
  { key: 'free', label: '自由裁剪', ratio: null },
  { key: 'original', label: '原图比例', ratio: 'original' as const },
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '4:3', label: '4:3', ratio: 4 / 3 },
  { key: '3:4', label: '3:4', ratio: 3 / 4 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
  { key: '9:16', label: '9:16', ratio: 9 / 16 },
  { key: '3:2', label: '3:2', ratio: 3 / 2 },
  { key: '2:3', label: '2:3', ratio: 2 / 3 },
] as const

export type ImageCropAspectKey = (typeof IMAGE_CROP_ASPECT_RATIOS)[number]['key']

export const IMAGE_EXPAND_ASPECT_RATIOS = [
  { key: 'original', label: '原图比例', ratio: 'original' as const },
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '2:3', label: '2:3', ratio: 2 / 3 },
  { key: '3:2', label: '3:2', ratio: 3 / 2 },
  { key: '3:4', label: '3:4', ratio: 3 / 4 },
  { key: '4:3', label: '4:3', ratio: 4 / 3 },
  { key: '4:5', label: '4:5', ratio: 4 / 5 },
  { key: '5:4', label: '5:4', ratio: 5 / 4 },
  { key: '9:16', label: '9:16', ratio: 9 / 16 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
] as const

export type ImageExpandAspectKey = (typeof IMAGE_EXPAND_ASPECT_RATIOS)[number]['key']

export type ImageToolbarHoverConfig = {
  tooltip?: string
  menu?: readonly string[]
}

export const IMAGE_TOOLBAR_MORE_HOVER: Record<string, ImageToolbarHoverConfig> = {
  split: { menu: ['4宫格', '9宫格', '自由'] },
  annotate: { tooltip: '标注' },
  decompose: { tooltip: '图层分离', menu: ['全部', '单个'] },
  erase: { tooltip: '消除', menu: ['智能', '快速'] },
  search: { tooltip: '搜同款', menu: ['同款', '类似'] },
  parse: { tooltip: '解析' },
}

export function getImageToolbarMoreHover(key: string) {
  return IMAGE_TOOLBAR_MORE_HOVER[key]
}

export const PROMPT_PLACEHOLDER =
  '请输入你想制作的内容，细节描述越多，效果会更符合你的期待哦。'

const NODE_CARD = nodeCardSize2x3()

export const NODE_SIZE = {
  text: { picker: { ...NODE_CARD }, editor: { width: 320, height: 220 } },
  image: {
    landscape: { ...NODE_CARD },
    portrait: { ...NODE_CARD },
    genPicker: { ...NODE_CARD },
    /** 图生图节点仅保留预览区，输入框在节点下方浮层 */
    img2img: { width: 300, height: 240 },
    hd: { width: 300, height: 360 },
  },
  video: {
    picker: { width: 350, height: 200 },
    landscape: { width: 350, height: 200 },
    /** 已上传 / 生成完成的视频预览卡片 */
    media: { width: 350, height: 200 },
  },
  audio: { picker: { ...NODE_CARD }, editor: { width: 320, height: 220 } },
  model3d: { editor: { width: 320, height: 360 } },
}

export function parseVideoAspectRatioValue(ratio?: string | null) {
  if (!ratio || ratio === 'auto') return null
  const parts = ratio.split(':').map((part) => Number(part.trim()))
  if (parts.length !== 2 || !(parts[0] > 0) || !(parts[1] > 0)) return null
  return parts[0] / parts[1]
}

/** 按视频比例计算节点尺寸（宽固定为默认视频卡片宽） */
export function computeVideoNodeSizeByAspectRatio(
  ratio: string,
  baseWidth = NODE_SIZE.video.media.width,
  minHeight = 120,
) {
  const aspect = parseVideoAspectRatioValue(ratio)
  if (!aspect) {
    return { ...NODE_SIZE.video.picker }
  }
  return {
    width: baseWidth,
    height: Math.max(minHeight, Math.round(baseWidth / aspect)),
  }
}

/** 视频节点按原始媒体比例自适应高度（含用户上传中） */
export function shouldAdaptVideoNodeHeight(data?: Partial<CanvasNodeData>) {
  if (!data) return false
  if (data.kind !== 'video') return false
  if (!(data.mediaWidth! > 0 && data.mediaHeight! > 0)) return false

  const isGenerating =
    data.uploadState === 'uploading' &&
    (data.generationTaskType === 'VIDEO' || Boolean(data.generationTaskId))
  if (isGenerating) return false

  if (data.previewUrl?.trim()) return true
  if (data.uploadState === 'uploading' && data.mode === 'editor') return true

  return false
}

export function getVideoAdaptiveNodeSize(data: Partial<CanvasNodeData>) {
  const mediaW = data.mediaWidth ?? 0
  const mediaH = data.mediaHeight ?? 0
  if (!mediaW || !mediaH) {
    return { ...NODE_SIZE.video.media }
  }
  const width = NODE_SIZE.video.media.width
  return {
    width,
    height: Math.max(120, Math.round((width * mediaH) / mediaW)),
  }
}

export const KIND_LABEL: Record<NodeKind, string> = {
  text: '文本节点',
  image: '图片节点',
  video: '视频节点',
  audio: '音频节点',
  model3d: '3D 模型',
}

export function formatDimensions(width: number, height: number) {
  if (!width || !height) return ''
  return `${width} × ${height}`
}

/** 图片节点是否可打开下方图片对话框（含图生图占位节点：无自身预览但有上游图源） */
export function canOpenImageDialogueOnNode(data: CanvasNodeData): boolean {
  if (data.kind !== 'image' || data.uploadState === 'uploading') return false
  if (data.previewUrl?.trim()) return true
  if (data.sourcePreviewUrl?.trim()) return true
  return Array.isArray(data.imageSourceRefs) &&
    data.imageSourceRefs.some((item) => item.previewUrl?.trim())
}

/** 节点是否已持久化图片对话溯源（生成结果节点打开对话框时应回填参考图与参数） */
export function hasPersistedImageDialogueProvenance(data: CanvasNodeData): boolean {
  if (data.imageDialogueText?.trim()) return true
  const settings = data.imageDialogueSettings
  if (!settings) return false
  return Boolean(
    settings.modelKey?.trim() ||
    settings.aspectRatio?.trim() ||
    settings.resolution?.trim() ||
    settings.workflowId?.trim(),
  )
}

/** 用户本地文件正在上传（显示「上传中」时隐藏删除按钮） */
export function isNodeFileUploading(data?: Partial<CanvasNodeData>) {
  if (!data || data.uploadState !== 'uploading') return false
  if (data.generationTaskType === 'VIDEO' || Boolean(data.generationTaskId)) return false
  return true
}

export function isPortrait(width: number, height: number) {
  return height > width
}

/** 是否为 AI 生成的图片节点（不可手动替换原图） */
export function isAiGeneratedImageNode(data?: Partial<CanvasNodeData> | null): boolean {
  if (!data || data.kind !== 'image') return false
  if (data.imageGenState === 'loading' || data.imageGenState === 'done') return true
  if (data.generationTaskType === 'IMAGE') return true
  if (String(data.generationTaskId ?? '').trim()) return true
  return false
}

/** 是否为 AI 任务生成的画布节点（图/文/视频/模型等） */
export function isAiGeneratedCanvasNode(data?: Partial<CanvasNodeData> | null): boolean {
  if (!data) return false
  if (isAiGeneratedImageNode(data)) return true
  if (data.generationTaskType === 'VIDEO' || data.generationTaskType === 'TEXT' || data.generationTaskType === 'MODEL') {
    return true
  }
  if (String(data.generationTaskId ?? '').trim()) return true
  if (data.textGenState === 'loading' || data.textGenState === 'done') return true
  if (data.kind === 'video' && data.uploadState === 'uploading') {
    return true
  }
  return false
}

/** 组内非 AI 生成且已有预览图的图片节点，可重新上传替换 */
export function canReplaceImageNodePreview(data?: Partial<CanvasNodeData> | null): boolean {
  if (!data || data.kind !== 'image') return false
  if (!String(data.groupId ?? '').trim()) return false
  if (!data.previewUrl?.trim()) return false
  if (data.compactPreview) return false
  if (data.gridSplitTile) return false
  if (isAiGeneratedImageNode(data)) return false
  return true
}

/** 图片生成任务进行中、尚无预览图时，按源图媒体比例占位 */
export function shouldAdaptImageGenerationPlaceholder(data?: Partial<CanvasNodeData>) {
  if (!data) return false
  if (data.kind !== 'image') return false
  if (data.imageGenState !== 'loading') return false
  if (data.previewUrl?.trim()) return false
  if (!(data.mediaWidth! > 0 && data.mediaHeight! > 0)) return false
  return true
}

/** 上传完成 / AI 生成完成后，按固定宽度与图片比例自适应高度 */
export function shouldAdaptImageNodeHeight(data?: Partial<CanvasNodeData>) {
  if (!data) return false
  if (data.kind !== 'image') return false
  if (data.compactPreview) return false
  if (!data.previewUrl?.trim()) return false
  if (data.uploadState === 'uploading') return false
  if (data.imageGenState === 'loading') return false
  if (!(data.mediaWidth! > 0 && data.mediaHeight! > 0)) return false
  if (data.editorWidth && data.editorHeight) return false
  if (data.imageGenTask) return false
  return true
}

export function getImageAdaptiveNodeSize(data: Partial<CanvasNodeData>) {
  const mediaW = data.mediaWidth ?? 0
  const mediaH = data.mediaHeight ?? 0
  if (!mediaW || !mediaH) {
    return nodeCardSize2x3()
  }
  const width = data.editorWidth ?? NODE_DEFAULT_WIDTH
  const contentW = Math.max(1, width - IMAGE_NODE_LAYOUT_BODY_BORDER)
  return {
    width,
    height: Math.max(
      120,
      IMAGE_NODE_LAYOUT_BODY_BORDER + Math.round((contentW * mediaH) / mediaW),
    ),
  }
}


export const VIDEO_GEN_MODE_TITLE = '动态呈现'
export const VIDEO_GEN_MODE_MENU = [
  {
    key: 'product-shot',
    label: '口播配音',
    children: [
      { key: '3d', label: '服装立体3D图', prompt: '请生成服装立体3D展示图，突出版型与立体感' },
      { key: 'flat', label: '服装平铺图', prompt: '请生成服装平铺展示图，背景干净、构图规整' },
      { key: 'detail', label: '服装细节图', prompt: '请生成服装细节特写图，突出工艺与材质纹理' },
      { key: 'fabric', label: '服装面料图', prompt: '请生成服装面料质感展示图，强调织物纹理与光泽' },
      { key: '360', label: '商品360°', prompt: '请生成商品360°展示方案，覆盖多角度呈现需求' },
    ],
  },
  {
    key: 'product-match',
    label: '商品搭配',
    children: [
      { key: 'outfit', label: '整套搭配', prompt: '请根据图片给出整套穿搭搭配方案' },
      { key: 'accessory', label: '配饰组合', prompt: '请推荐与图片商品协调的配饰组合' },
      { key: 'display', label: '场景陈列', prompt: '请给出商品场景化陈列与布景建议' },
    ],
  },
  {
    key: 'model-pose',
    label: '模特姿态',
    children: [
      { key: 'standing', label: '站姿展示', prompt: '请推荐适合该商品的模特站姿与肢体表现' },
      { key: 'walking', label: '走步动态', prompt: '请推荐走步动态姿势，突出服装垂坠与动感' },
      { key: 'closeup', label: '半身特写', prompt: '请推荐半身特写姿态，突出上身版型与细节' },
    ],
  },
  {
    key: 'model-tryon',
    label: '模特试穿',
    children: [
      { key: 'fit', label: '合身效果', prompt: '请生成模特试穿合身效果展示方案' },
      { key: 'layer', label: '叠穿展示', prompt: '请生成模特叠穿试穿效果展示方案' },
      { key: 'compare', label: '尺码对比', prompt: '请给出不同尺码试穿对比展示建议' },
    ],
  },
  {
    key: 'digital-model',
    label: '数字人模特',
    children: [
      { key: 'avatar', label: '虚拟形象', prompt: '请推荐适合该商品的数字人虚拟形象设定' },
      { key: 'motion', label: '动作演绎', prompt: '请设计数字人模特动作演绎脚本' },
      { key: 'scene', label: '场景融合', prompt: '请给出数字人模特与商品场景融合方案' },
    ],
  },
] as const
