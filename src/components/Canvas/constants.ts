export type NodeKind = 'text' | 'image' | 'video' | 'audio'

export type NodeMode = 'picker' | 'editor'

export type UploadState = 'idle' | 'uploading' | 'done'

export type ImageGenTask = 'picker' | 'img2img' | 'hd'

/** 画布图片节点拖入对话框时 dataTransfer 的 MIME 类型 */
export const CANVAS_IMAGE_NODE_DRAG_TYPE = 'application/x-canvas-image-node-id'

/** 素材面板图片拖入画布时 dataTransfer 的 MIME 类型 */
export const CANVAS_ASSET_DRAG_TYPE = 'application/x-canvas-asset'

export interface CanvasAssetDragPayload {
  previewUrl: string
  fileName?: string
  width?: number | null
  height?: number | null
}

/** 由上游节点连线带过来的图片输入源 */
export interface ImageSourceRef {
  nodeId: string
  previewUrl: string
  fileName?: string
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
  isSelected?: boolean
  /** 节点所属分组 ID，同组节点可整组移动与解组 */
  groupId?: string
  imageGenTask?: ImageGenTask
  sourceNodeId?: string
  sourcePreviewUrl?: string
  sourceFileName?: string
  /** 多个上游节点连线带过来的图片输入源（图生图多图参考），按连入顺序排列 */
  imageSourceRefs?: ImageSourceRef[]
  inputUpdated?: boolean
  genPrompt?: string
  genSeed?: number
  videoGenTab?: string
  viewScale?: number
  editorWidth?: number
  editorHeight?: number
  textPickerTask?: 'img2prompt' | 'text2video' | 'write' | ''
  /** 自由输入提示词生成后，底部输入框保持显示 */
  promptBarPinned?: boolean
  textGenState?: 'idle' | 'loading' | 'done'
  /** 图片反推提示词生成进度（0-100），loading 时用于显示「准备中 / 生成中 X%」 */
  textGenProgress?: number
  linkedImageNodeId?: string
  /** 文生图节点生成态：idle 待生成 / loading 生成中 / done 已生成 */
  imageGenState?: 'idle' | 'loading' | 'done'
  /** 文生图生成进度（0-100） */
  imageGenProgress?: number
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

export const EMPTY_HINT = '双击画布 自由生成节点'

/** 图片节点标题栏高度 + 与预览区间距，用于工具栏锚定在图片区域正上方 */
export const IMAGE_NODE_META_HEIGHT = 30

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
  { key: 'text2video', label: '文生视频', icon: 'play' },
  { key: 'img2prompt', label: '图片反推提示词', icon: 'image' },
  // { key: 'text2music', label: '文字生音乐', icon: 'audio' },
]

export const VIDEO_PICKER_ACTIONS = [
  // { key: 'frames', label: '首尾帧生成视频', icon: 'frames' },
  // { key: 'first', label: '首帧生成视频', icon: 'spark' },
]

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

export type ImageToolbarMenuItem = {
  key: string
  label: string
  icon: ImageToolbarIcon
  hasSubmenu?: boolean
}

export const IMAGE_NODE_TOOLBAR = {
  chat: { key: 'chat', label: '对话', icon: 'chat' as const },
  actions: [
    { key: 'cutout', label: '抠图', icon: 'cutout' },
    { key: 'hd', label: 'HD 高清' },
    { key: 'crop', label: '裁剪', icon: 'crop' },
    { key: 'inpaint', label: '局部修改', icon: 'edit' },
    { key: 'preview', label: '预览', icon: 'preview' },
    { key: 'addToDialog', label: '', icon: 'addToDialog' },
    { key: 'more', label: '更多', icon: 'more' },
  ] satisfies ImageToolbarAction[],
} as const

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

export const IMAGE_DIALOGUE_GREETING = 'Hi, 我是你的AI设计助理'
export const IMAGE_DIALOGUE_PLACEHOLDER =
  '可直接文字生图，或上传图片输入文字指令对图片进行编辑，如：将背景改为雪夜'
export const IMAGE_DIALOGUE_MODEL_LABEL = 'Lib Image'
export const IMAGE_DIALOGUE_QUALITY_LABEL = '自适应 · 标准画质 · 2K'
export const IMAGE_DIALOGUE_CREDITS = '22'
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
  icon: ImageDialogueModelIcon
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
  '写下你想讲的故事、场景或角色设定，例如：一个来自未来的机器人，在城市屋顶看星星。'

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
    picker: { ...NODE_CARD },
    /** 未上传视频时与文本/图片卡片同尺寸 */
    landscape: { ...NODE_CARD },
    /** 已上传视频按 2:3 展示，宽 180 */
    media: { ...NODE_CARD },
  },
  audio: { picker: { ...NODE_CARD }, editor: { width: 320, height: 220 } },
}

export const KIND_LABEL: Record<NodeKind, string> = {
  text: '文本节点',
  image: '图片节点',
  video: '视频节点',
  audio: '音频节点',
}

export function formatDimensions(width: number, height: number) {
  if (!width || !height) return ''
  return `${width} × ${height}`
}

export function isPortrait(width: number, height: number) {
  return height > width
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