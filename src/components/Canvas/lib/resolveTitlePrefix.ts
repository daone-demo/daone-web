/** 从节点标题解析能力前缀（`抠图-xxx` → `抠图`） */
export function resolveTitlePrefix(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) return ''
  const dash = trimmed.indexOf('-')
  if (dash > 0) return trimmed.slice(0, dash).trim()
  return trimmed
}
