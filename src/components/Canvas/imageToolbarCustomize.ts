import {
  buildImageToolbarActionsFromCapabilities,
  IMAGE_NODE_TOOLBAR,
  toCapabilityToolbarActions,
  type ImageCapability,
  type ImageCapabilityToolbarAction,
} from './constants'

export const IMAGE_TOOLBAR_CUSTOMIZE_STORAGE_KEY = 'daone:image-toolbar-customize'

/** 第一页预览中间展示的工具数量 */
export const IMAGE_TOOLBAR_PREVIEW_PRIMARY_LIMIT = 5

export type ImageToolbarCustomizeSettings = {
  orderedKeys: string[]
  showToolNames: boolean
}

export const DEFAULT_IMAGE_TOOLBAR_CUSTOMIZE_SETTINGS: ImageToolbarCustomizeSettings = {
  orderedKeys: [],
  showToolNames: true,
}

export function buildSortableImageToolbarActions(
  capabilities: ImageCapability[] | null | undefined,
): ImageCapabilityToolbarAction[] {
  const fromApi = buildImageToolbarActionsFromCapabilities(capabilities)
  if (fromApi.length) return fromApi
  return toCapabilityToolbarActions(IMAGE_NODE_TOOLBAR.actions)
}

export function loadImageToolbarCustomizeSettings(): ImageToolbarCustomizeSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_IMAGE_TOOLBAR_CUSTOMIZE_SETTINGS }
  }

  try {
    const raw = window.localStorage.getItem(IMAGE_TOOLBAR_CUSTOMIZE_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_IMAGE_TOOLBAR_CUSTOMIZE_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<ImageToolbarCustomizeSettings>
    return {
      orderedKeys: Array.isArray(parsed.orderedKeys)
        ? parsed.orderedKeys.filter((key): key is string => typeof key === 'string')
        : [],
      // 始终展示工具名称，避免部分浏览器仅显示图标或出现转义文本
      showToolNames: true,
    }
  } catch {
    return { ...DEFAULT_IMAGE_TOOLBAR_CUSTOMIZE_SETTINGS }
  }
}

export function saveImageToolbarCustomizeSettings(settings: ImageToolbarCustomizeSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    IMAGE_TOOLBAR_CUSTOMIZE_STORAGE_KEY,
    JSON.stringify({
      orderedKeys: settings.orderedKeys,
      showToolNames: true,
    }),
  )
}

export function orderImageToolbarActions(
  actions: ImageCapabilityToolbarAction[],
  settings?: ImageToolbarCustomizeSettings | null,
): ImageCapabilityToolbarAction[] {
  if (!actions.length) return []
  const orderedKeys = settings?.orderedKeys ?? []
  if (!orderedKeys.length) return [...actions]

  const actionMap = new Map(actions.map((item) => [item.key, item]))
  const ordered: ImageCapabilityToolbarAction[] = []

  orderedKeys.forEach((key) => {
    const item = actionMap.get(key)
    if (!item) return
    ordered.push(item)
    actionMap.delete(key)
  })

  actions.forEach((item) => {
    if (actionMap.has(item.key)) {
      ordered.push(item)
    }
  })

  return ordered
}

export function createDefaultOrderedKeys(actions: ImageCapabilityToolbarAction[]) {
  return actions.map((item) => item.key)
}

export function splitImageToolbarPreviewActions(
  actions: ImageCapabilityToolbarAction[],
  primaryLimit = IMAGE_TOOLBAR_PREVIEW_PRIMARY_LIMIT,
) {
  const list = [...actions]
  return {
    primaryActions: list.slice(0, primaryLimit),
    overflowActions: list.slice(primaryLimit),
  }
}

export function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return list
  }

  const next = [...list]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}
