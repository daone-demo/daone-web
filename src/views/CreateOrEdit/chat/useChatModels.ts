import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import {
  listImageDialogueModelEntries,
  listVideoDialogueModelEntries,
  normalizeDialogueModelIcon,
} from '@/components/Canvas/constants'
import type { ChatTools, ImageCapability } from '@/components/Canvas/constants'

export type ChatModelCategory = 'image' | 'video' | 'audio'

export interface ChatModelItem {
  key: string
  category: ChatModelCategory
  value: string
  label: string
  subtitle?: string
  icon: string
}

export const MODEL_CATEGORY_TABS: { key: ChatModelCategory; label: string }[] = [
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  // { key: 'audio', label: '音频' },
]

export const AUTO_MODE_MODELS: Record<string, string> = {
  Auto: 'gpt5.5',
  Fast: 'gpt5.5',
  Quality: 'Codex',
}

export function resolveChatModelIcon(apiIcon: string | undefined, fallback: string): string {
  const normalized = normalizeDialogueModelIcon(apiIcon)
  return normalized || fallback
}

export function parseModelsFromCapability(
  capability: ImageCapability | null | undefined,
  category: ChatModelCategory,
  fallbackIcon: string,
): ChatModelItem[] {
  if (!capability?.parameters) return []

  if (category === 'image') {
    return listImageDialogueModelEntries({ image: capability }).map((entry) => ({
      key: `image:${entry.key}`,
      category,
      value: entry.key,
      label: entry.label,
      subtitle: entry.resolutions[entry.resolutions.length - 1] || undefined,
      icon: resolveChatModelIcon(entry.icon, fallbackIcon),
    }))
  }

  if (category === 'video') {
    return listVideoDialogueModelEntries({ video: capability }).map((entry) => ({
      key: `video:${entry.key}`,
      category,
      value: entry.key,
      label: entry.label,
      subtitle: entry.resolutions[entry.resolutions.length - 1]?.label || undefined,
      icon: resolveChatModelIcon(entry.icon, fallbackIcon),
    }))
  }

  const params = capability.parameters
  const models = params.models
  if (Array.isArray(models) && models.length) {
    const result: ChatModelItem[] = []
    models.forEach((item) => {
      if (!item || typeof item !== 'object') return
      const row = item as Record<string, unknown>
      const value = String(row.value ?? row.key ?? row.id ?? row.model ?? '').trim()
      if (!value) return
      const label = String(row.label ?? row.name ?? row.title ?? value).trim()
      result.push({
        key: `${category}:${value}`,
        category,
        value,
        label,
        icon: resolveChatModelIcon(typeof row.icon === 'string' ? row.icon : undefined, fallbackIcon),
      })
    })
    return result
  }

  const legacyModels = params.model
  if (!Array.isArray(legacyModels)) return []
  return legacyModels
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .map((value) => ({
      key: `${category}:${value}`,
      category,
      value,
      label: value,
      icon: fallbackIcon,
    }))
}

export interface UseChatModelsOptions {
  chatTools: MaybeRefOrGetter<ChatTools | null | undefined>
  showAutoMenu?: Ref<boolean>
  closeSkillMenu?: () => void
}

export function useChatModels(options: UseChatModelsOptions) {
  const activeModelCategory = ref<ChatModelCategory>('image')
  const selectedModelKeys = ref<Set<string>>(new Set())
  const showModelMenu = ref(false)

  const chatToolsData = computed(() => (toValue(options.chatTools) ?? {}) as ChatTools)
  const modelCategoryTabs = computed(() => MODEL_CATEGORY_TABS)

  const allChatModels = computed<ChatModelItem[]>(() => {
    const tools = chatToolsData.value
    const imageModels = parseModelsFromCapability(tools.image, 'image', 'image')
    const videoModels = parseModelsFromCapability(tools.video, 'video', 'video')
    const audioModels = parseModelsFromCapability(tools.text, 'audio', 'audio')
    return [...imageModels, ...videoModels, ...audioModels]
  })

  const modelsInActiveCategory = computed(() =>
    allChatModels.value.filter((item) => item.category === activeModelCategory.value),
  )

  const modelButtonLabel = computed(() => {
    const count = selectedModelKeys.value.size
    return count > 0 ? `模型 · ${count}` : '模型'
  })

  const isAllModelsSelectedInTab = computed(() => {
    const models = modelsInActiveCategory.value
    if (!models.length) return false
    return models.every((item) => selectedModelKeys.value.has(item.key))
  })

  function closeModelMenu() {
    showModelMenu.value = false
  }

  function toggleModelMenu() {
    showModelMenu.value = !showModelMenu.value
    if (showModelMenu.value) {
      options.closeSkillMenu?.()
      if (options.showAutoMenu) options.showAutoMenu.value = false
    }
  }

  function toggleModelSelection(key: string) {
    const next = new Set(selectedModelKeys.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selectedModelKeys.value = next
  }

  function toggleSelectAllModelsInTab() {
    const models = modelsInActiveCategory.value
    if (!models.length) return
    const next = new Set(selectedModelKeys.value)
    const shouldSelectAll = !isAllModelsSelectedInTab.value
    models.forEach((item) => {
      if (shouldSelectAll) next.add(item.key)
      else next.delete(item.key)
    })
    selectedModelKeys.value = next
  }

  function resolveModel(mode: string) {
    if (selectedModelKeys.value.size > 0) {
      const firstKey = Array.from(selectedModelKeys.value)[0]
      const model = allChatModels.value.find((item) => item.key === firstKey)
      if (model) return model.value
    }
    return AUTO_MODE_MODELS[mode] ?? 'gpt5.5'
  }

  return {
    activeModelCategory,
    selectedModelKeys,
    showModelMenu,
    chatToolsData,
    allChatModels,
    modelsInActiveCategory,
    modelButtonLabel,
    isAllModelsSelectedInTab,
    modelCategoryTabs,
    closeModelMenu,
    toggleModelMenu,
    toggleModelSelection,
    toggleSelectAllModelsInTab,
    resolveModel,
  }
}
