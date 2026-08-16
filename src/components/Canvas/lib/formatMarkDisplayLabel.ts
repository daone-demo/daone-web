export type MarkDisplayLabelLike = {
  id: string
  label: string
  pending?: boolean
}

export function formatMarkDisplayLabel(
  mark: MarkDisplayLabelLike,
  marks: MarkDisplayLabelLike[] = [],
) {
  const index = marks.findIndex((item) => item.id === mark.id)
  const order = index >= 0 ? index + 1 : marks.length + 1
  const label = mark.pending ? '识别中' : mark.label
  return `${order}. ${label}`
}
