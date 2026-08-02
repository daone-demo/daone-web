import { computed, onBeforeUnmount, ref } from 'vue'
import type { ImageMarkItem } from './constants'
import { parseImageMarkMentionToken } from './promptMention'

export function getMarkLabelOptions(mark: ImageMarkItem) {
  const options = mark.labelOptions?.filter(Boolean) ?? []
  if (options.length) return options
  return mark.label ? [mark.label] : []
}

export function hasMultipleMarkLabels(mark: ImageMarkItem) {
  return getMarkLabelOptions(mark).length > 1
}

export function useImageMarkLabelMenu(options: {
  getMarks: () => ImageMarkItem[] | undefined
  onSelectLabel: (markId: string, index: number) => void
  onAfterSelect?: () => void
}) {
  const menu = ref<{ markId: string; left: number; top: number } | null>(null)

  const activeMark = computed(() =>
    options.getMarks()?.find((mark) => mark.id === menu.value?.markId),
  )

  const activeMarkOptions = computed(() =>
    activeMark.value ? getMarkLabelOptions(activeMark.value) : [],
  )

  const activeMarkSelectedIndex = computed(() => activeMark.value?.selectedLabelIndex ?? 0)

  function closeMenu() {
    menu.value = null
  }

  function openMenuForMark(markId: string, anchor: HTMLElement, container: HTMLElement) {
    const mark = options.getMarks()?.find((item) => item.id === markId)
    if (!mark || !hasMultipleMarkLabels(mark)) return

    const anchorRect = anchor.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    menu.value = {
      markId,
      left: anchorRect.left - containerRect.left,
      top: anchorRect.bottom - containerRect.top + 6,
    }
  }

  function openMenuFromMention(mentionEl: HTMLElement, container: HTMLElement) {
    const token = mentionEl.dataset.mention ?? ''
    const parsed = parseImageMarkMentionToken(token)
    if (!parsed?.markId) return
    openMenuForMark(parsed.markId, mentionEl, container)
  }

  function selectOption(index: number) {
    if (!menu.value) return
    options.onSelectLabel(menu.value.markId, index)
    closeMenu()
    options.onAfterSelect?.()
  }

  function onDocumentMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement | null
    if (target?.closest('.mark-label-option-menu')) return
    if (target?.closest('.mark-tags-echo')) return
    if (target?.closest('[data-mention^="@标记"]')) return
    closeMenu()
  }

  function bindDocumentClose() {
    document.addEventListener('mousedown', onDocumentMouseDown)
  }

  function unbindDocumentClose() {
    document.removeEventListener('mousedown', onDocumentMouseDown)
  }

  onBeforeUnmount(unbindDocumentClose)

  return {
    menu,
    activeMark,
    activeMarkOptions,
    activeMarkSelectedIndex,
    openMenuForMark,
    openMenuFromMention,
    selectOption,
    closeMenu,
    bindDocumentClose,
    unbindDocumentClose,
  }
}
