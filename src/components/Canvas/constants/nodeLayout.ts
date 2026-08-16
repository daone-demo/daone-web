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
