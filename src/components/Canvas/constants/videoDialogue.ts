import {
  IMAGE_NODE_LAYOUT_BODY_BORDER,
  NODE_DEFAULT_WIDTH,
  NODE_SIZE,
  nodeCardSize2x3,
} from './nodeLayout'
import { VIDEO_GEN_TABS } from './nodeMenus'
import type { CanvasNodeData, NodeKind } from './nodeData'
import {
  type ImageCapability,
  normalizeImageCapabilities,
} from './capabilities'
import {
  type ImageDialogueSource,
  type ImageDialogueAspectRatioOption,
  type ChatTools,
  normalizeDialogueModelIcon,
  parseCapabilityStringArray,
  parseCapabilityModelOptions,
  parseCapabilityCountRange,
  resolveAspectRatioPreview,
} from './imageDialogue'

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

export type VideoDialogueModelMode = {
  label: string
  value: VideoDialogueMode
  enable: boolean
  /** 当前模式是否禁止修改比例；未下发时视为 false，不影响现有可选逻辑 */
  disableRatio?: boolean
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
  /** 模型支持的生成模式（来自 capabilities.models[].modes） */
  modes: VideoDialogueModelMode[]
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

function parseVideoModelModes(value: unknown): VideoDialogueModelMode[] {
  if (!Array.isArray(value)) return []
  const result: VideoDialogueModelMode[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const rawValue = row.value ?? row.key ?? row.mode
    const modeValue = typeof rawValue === 'string' ? rawValue.trim() : ''
    if (!modeValue) continue
    if (
      modeValue !== 'text-to-video' &&
      modeValue !== 'image-to-video' &&
      modeValue !== 'reference' &&
      modeValue !== 'first-last-frame'
    ) {
      continue
    }
    const rawLabel = row.label ?? row.name ?? modeValue
    const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : modeValue
    const enable = row.enable === false || row.enabled === false ? false : true
    result.push({
      label,
      value: modeValue as VideoDialogueMode,
      enable,
      ...(row.disableRatio === true ? { disableRatio: true } : {}),
    })
  }
  return result
}

/** API mode → 视频生成面板 tab key */
export function mapVideoApiModeToTab(mode: string): string {
  switch (mode) {
    case 'image-to-video':
      return 'img2video'
    case 'first-last-frame':
      return 'frames'
    case 'reference':
      return 'reference'
    case 'text-to-video':
    default:
      return 'text2video'
  }
}

/** 当前模型可用的视频生成模式（仅 enable=true） */
export function listEnabledVideoDialogueModesForModel(
  source: VideoDialogueSource | undefined | null,
  modelKey?: string | null,
): VideoDialogueModelMode[] {
  const entry = findVideoDialogueModelEntry(source ?? undefined, modelKey)
  const modes = entry?.modes ?? []
  return modes.filter((mode) => mode.enable)
}

/**
 * 当前选中 mode 是否禁止修改比例。
 * 无 modes 配置、或未下发 disableRatio 时返回 false，保持原可选行为。
 */
export function isVideoDialogueRatioDisabled(
  source: VideoDialogueSource | undefined | null,
  modelKey?: string | null,
  modeOrTab?: string | null,
): boolean {
  if (!modeOrTab) return false
  const entry = findVideoDialogueModelEntry(source ?? undefined, modelKey)
  const modes = entry?.modes ?? []
  if (!modes.length) return false
  const apiMode =
    modeOrTab === 'text-to-video' ||
    modeOrTab === 'image-to-video' ||
    modeOrTab === 'reference' ||
    modeOrTab === 'first-last-frame'
      ? modeOrTab
      : resolveVideoGenApiMode(modeOrTab)
  return modes.some((item) => item.value === apiMode && item.disableRatio === true)
}

/**
 * 按模型 modes 构建视频生成面板 tabs。
 * 无 modes 配置时回退到默认 VIDEO_GEN_TABS（兼容旧接口）。
 */
export function buildVideoGenTabsForModel(
  source: VideoDialogueSource | undefined | null,
  modelKey?: string | null,
): Array<{ key: string; label: string; disabled?: boolean; disabledHint?: string }> {
  const modes = listEnabledVideoDialogueModesForModel(source, modelKey)
  if (!modes.length) {
    return VIDEO_GEN_TABS.filter((tab) =>
      tab.key === 'text2video' || tab.key === 'reference' || tab.key === 'frames',
    ).map((tab) => ({ ...tab }))
  }
  return modes.map((mode) => ({
    key: mapVideoApiModeToTab(mode.value),
    label: mode.label,
    disabled: false,
    disabledHint: '',
  }))
}

/**
 * 切换模型后校正当前 tab：
 * 当前模式不被新模型支持时，优先回退到「全能参考」，否则取第一个可用 tab。
 */
export function resolveVideoGenTabForModel(
  currentTab: string,
  source: VideoDialogueSource | undefined | null,
  modelKey?: string | null,
): string {
  const tabs = buildVideoGenTabsForModel(source, modelKey)
  if (!tabs.length) return currentTab || 'reference'
  if (tabs.some((tab) => tab.key === currentTab)) return currentTab
  if (tabs.some((tab) => tab.key === 'reference')) return 'reference'
  return tabs[0].key
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
  const modes = parseVideoModelModes(row.modes)

  return {
    key: value,
    label,
    ...(icon ? { icon } : {}),
    duration: row.duration ? duration : fallback.duration,
    ratios: ratios.length ? ratios : fallback.ratios,
    resolutions: resolutions.length ? resolutions : fallback.resolutions,
    generateAudio: generateAudio.length ? generateAudio : fallback.generateAudio,
    countOptions: countOptions.length ? countOptions : fallback.countOptions,
    modes,
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
    modes: [],
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
    mode: resolveVideoDialogueModeForModel(partial.mode ?? 'reference', source, modelKey),
  }
}

/** 切换模型后校正 mode：不支持时优先回退到 reference */
export function resolveVideoDialogueModeForModel(
  currentMode: VideoDialogueMode | string | undefined,
  source?: VideoDialogueSource,
  modelKey?: string | null,
): VideoDialogueMode {
  const mode = (currentMode as VideoDialogueMode) || 'reference'
  const modes = listEnabledVideoDialogueModesForModel(source, modelKey)
  if (!modes.length) return mode
  if (modes.some((item) => item.value === mode)) return mode
  if (modes.some((item) => item.value === 'reference')) return 'reference'
  return modes[0].value
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

/** 图生图拉出的待生成占位节点：下方对话框隐藏工作流与标记；已有媒体资源节点不受影响 */
export function isPendingImageGenDialogueTarget(data?: CanvasNodeData | null): boolean {
  if (!data || data.kind !== 'image') return false
  if (!data.imageGenTask) return false
  return !data.previewUrl?.trim()
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
  if (
    data.imageGenState === 'loading' ||
    data.imageGenState === 'done' ||
    data.imageGenState === 'failed'
  ) {
    return true
  }
  if (data.generationTaskType === 'IMAGE') return true
  if (data.generationParams?.taskType === 'IMAGE') return true
  if (String(data.generationParams?.capabilityCode ?? '').trim()) return true
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

/** 组内源图且非 AI 生成、已有预览图的图片节点，可重新上传替换 */
export function canReplaceImageNodePreview(data?: Partial<CanvasNodeData> | null): boolean {
  if (!data || data.kind !== 'image') return false
  if (!String(data.groupId ?? '').trim()) return false
  if (!data.previewUrl?.trim()) return false
  if (data.compactPreview) return false
  if (data.gridSplitTile) return false
  const title = String(data.title ?? '').trim()
  if (/^宫格-\d+-\d+/.test(title)) return false
  if (/^宫格-\d+-\d+/.test(String(data.fileName ?? '').trim())) return false
  if (data.cropResult) return false
  if (title === '裁剪结果' || title.startsWith('裁剪-')) return false
  if (String(data.fileName ?? '').trim().startsWith('裁剪-')) return false
  if (data.uploadState === 'uploading') return false
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

