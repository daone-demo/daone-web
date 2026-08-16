import type { WorkflowRecord } from './workflows'
import {
  IMAGE_GENERAL_CAPABILITY_CODE,
  normalizeImageCapabilities,
  type ImageCapability,
} from './capabilities'

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

export function parseCapabilityStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

/** chat-tools parameters.modelOptions: [{ value, label, ... }] */
export function parseCapabilityModelOptions(value: unknown): Array<{
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

export function parseCapabilityCountRange(parameters?: Record<string, unknown>): number[] {
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

export function resolveAspectRatioPreview(ratio: string): { width: number; height: number } {
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
