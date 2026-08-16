import { DEFAULT_GENERATION_FAIL_MESSAGE } from './textPrompt'
import type { CanvasGenerationParams } from './capabilities'
import type { ImageDialogueSettings } from './imageDialogue'
import type { VideoDialogueSettings } from './videoDialogue'
import { normalizeAssetId } from '../lib/normalizeAssetId'

export { normalizeAssetId } from '../lib/normalizeAssetId'

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
  /** 打组后用户自定义的选区范围（可大于节点占位，随画布持久化） */
  groupSelectionBox?: {
    x: number
    y: number
    width: number
    height: number
  }
  /** 打组后用户自定义的组标题 */
  groupTitle?: string
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
  /** 裁剪产物（非源图，不可重新上传替换） */
  cropResult?: boolean
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
  /**
   * 同一 generationTaskId 多结果时的结果下标（0-based）。
   * 整组执行时用于识别共享任务节点，并将 results[index] 写回对应节点。
   */
  generationResultIndex?: number
  /** Agent / 后端返回的生成任务名称，用于节点完成态标题 */
  generationTaskName?: string
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
  if ('assetId' in source) {
    const assetId = normalizeAssetId(source.assetId)
    if (assetId) return assetId
  }
  if ('sourceAssetId' in source) {
    const sourceAssetId = normalizeAssetId(source.sourceAssetId)
    if (sourceAssetId) return sourceAssetId
  }
  return ''
}

/** 从视频节点数据解析素材库资源 ID（独立于图片侧） */
export function resolveVideoAssetId(
  source?: Pick<CanvasNodeData, 'assetId' | 'sourceAssetId'> | null,
): string {
  if (!source) return ''
  const assetId = normalizeAssetId(source.assetId)
  if (assetId) return assetId
  const sourceAssetId = normalizeAssetId(source.sourceAssetId)
  if (sourceAssetId) return sourceAssetId
  return ''
}
