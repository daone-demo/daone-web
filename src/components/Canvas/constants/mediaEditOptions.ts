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
