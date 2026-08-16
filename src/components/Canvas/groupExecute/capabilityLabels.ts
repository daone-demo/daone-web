import {
  IMAGE_DESIGN_ADVISOR_MENU,
  IMAGE_DESIGN_WORKFLOW_MENU,
  IMAGE_GENERAL_CAPABILITY_CODE,
  findCapabilityCodeByName,
  resolveSubmittableCapabilityCode,
  type CanvasNodeData,
} from '../constants'
import { resolveTitlePrefix } from '../lib/resolveTitlePrefix'

export { resolveTitlePrefix } from '../lib/resolveTitlePrefix'

type CapabilityLabelEntry = { label: string; code: string; prompt?: string }

function flattenImageDialogueMenuLabels(
  menus: ReadonlyArray<{
    children?: ReadonlyArray<{ label: string; prompt?: string; key?: string }>
  }>,
): CapabilityLabelEntry[] {
  const entries: CapabilityLabelEntry[] = []
  for (const group of menus) {
    for (const child of group.children ?? []) {
      const label = child.label?.trim()
      if (!label) continue
      entries.push({
        label,
        code: IMAGE_GENERAL_CAPABILITY_CODE,
        prompt: child.prompt,
      })
    }
  }
  return entries
}

/**
 * 节点标题前缀 → 能力码。只登记后端真实存在的能力码：
 * 工具栏兜底常量里的 hd / crop / preview 等只是本地 UI key，提交会被判为「AI 能力不存在」。
 * 未覆盖的能力名走接口返回的能力列表匹配。
 */
const CAPABILITY_LABEL_ENTRIES: CapabilityLabelEntry[] = [
  { label: '抠图', code: 'IMAGE_REMOVE_BG' },
  { label: '局部修改', code: 'IMAGE_INPAINT' },
  { label: '反推提示词', code: 'IMAGE_PROMPT_REVERSE' },
  { label: '图生3D', code: 'IMAGE_TO_3D' },
  ...flattenImageDialogueMenuLabels(IMAGE_DESIGN_ADVISOR_MENU),
  ...flattenImageDialogueMenuLabels(IMAGE_DESIGN_WORKFLOW_MENU),
]

function findCapabilityLabelEntry(titlePrefix: string): CapabilityLabelEntry | null {
  const trimmed = titlePrefix.trim()
  if (!trimmed) return null
  return (
    CAPABILITY_LABEL_ENTRIES.find(
      (item) => item.label === trimmed || trimmed.includes(item.label),
    ) ?? null
  )
}

export function resolveAdvisorPromptFromTitle(title: string): string {
  const prefix = resolveTitlePrefix(title)
  const matched = findCapabilityLabelEntry(prefix)
  return matched?.prompt?.trim() || ''
}

export function resolveImageCapabilityFromNode(
  data: CanvasNodeData,
): { code: string; label: string } | null {
  const titlePrefix = resolveTitlePrefix(data.title || data.fileName || '')
  if (titlePrefix) {
    const matched = findCapabilityLabelEntry(titlePrefix)
    if (matched) {
      return {
        code: resolveSubmittableCapabilityCode(matched.code, IMAGE_GENERAL_CAPABILITY_CODE),
        label: matched.label,
      }
    }
  }

  const savedCapabilityCode = String(data.generationParams?.capabilityCode ?? '').trim()
  if (savedCapabilityCode) {
    const code = resolveSubmittableCapabilityCode(
      savedCapabilityCode,
      IMAGE_GENERAL_CAPABILITY_CODE,
    )
    return {
      code,
      label:
        titlePrefix || data.title || (code === IMAGE_GENERAL_CAPABILITY_CODE ? '图生图' : '生成'),
    }
  }

  // 静态表未覆盖的能力：工作流节点标题由能力名生成，按接口能力列表回查
  const liveCapability = titlePrefix ? findCapabilityCodeByName(titlePrefix) : null
  if (liveCapability) {
    return {
      code: resolveSubmittableCapabilityCode(liveCapability.code, IMAGE_GENERAL_CAPABILITY_CODE),
      label: liveCapability.label,
    }
  }

  const prompt =
    data.imageDialogueText?.trim() ||
    data.genPrompt?.trim() ||
    data.generationParams?.prompt?.trim() ||
    ''
  const hasDialogueConfig = Boolean(
    data.generationParams ||
    data.imageDialogueSettings?.modelKey ||
    data.imageDialogueSettings?.aspectRatio ||
    data.imageDialogueSettings?.workflowId,
  )
  if (prompt || hasDialogueConfig || data.imageSourceRefs?.length) {
    return {
      code: IMAGE_GENERAL_CAPABILITY_CODE,
      label: data.title === '文生图' ? '文生图' : '图生图',
    }
  }

  return null
}
