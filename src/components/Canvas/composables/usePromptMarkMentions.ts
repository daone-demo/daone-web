import type { ImageMarkItem } from '../constants'
import {
  buildMarkMentionThumbStyle,
  parseImageMarkMentionToken,
  type PromptMarkMentionMeta,
} from '../promptMention'
import { getMarkLabelOptions, hasMultipleMarkLabels } from '../useImageMarkLabelMenu'
import { formatMarkDisplayLabel } from '../lib/formatMarkDisplayLabel'

export { formatMarkDisplayLabel } from '../lib/formatMarkDisplayLabel'

export function getMarkThumbStyle(mark: ImageMarkItem, thumbUrl: string) {
  return buildMarkMentionThumbStyle({
    thumbUrl,
    imageWidth: mark.imageWidth,
    imageHeight: mark.imageHeight,
    bbox: mark.bbox,
  })
}

export function resolveMarkMentionMeta(
  token: string,
  options: {
    marks: ImageMarkItem[]
    resolvePreviewUrl: (mark: ImageMarkItem) => string
  },
): PromptMarkMentionMeta | null {
  const parsed = parseImageMarkMentionToken(token)
  if (!parsed) return null

  const marks = options.marks
  const mark = marks.find(
    (item) =>
      item.mentionToken === token ||
      (parsed.markId && item.id === parsed.markId) ||
      (parsed.label && item.label === parsed.label),
  )

  const labelOptions = mark ? getMarkLabelOptions(mark) : parsed.label ? [parsed.label] : []
  const label = mark ? formatMarkDisplayLabel(mark, marks) : parsed.label ? parsed.label : token
  if (!mark) {
    return {
      label,
      markId: parsed.markId || undefined,
      labelOptions,
      switchable: labelOptions.length > 1,
    }
  }

  return {
    label,
    markId: mark.id,
    labelOptions,
    selectedLabelIndex: mark.selectedLabelIndex ?? 0,
    switchable: hasMultipleMarkLabels(mark),
    thumbStyle: getMarkThumbStyle(mark, options.resolvePreviewUrl(mark)),
  }
}
