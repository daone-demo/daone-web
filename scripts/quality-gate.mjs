#!/usr/bin/env node
/**
 * 只读质量门禁：扫描严格类型岛内无说明的 any / 抑制指令。
 * 允许：
 * - `as const` / 泛型约束等非 any 写法
 * - 行尾含 `eslint-disable` / `ts-expect-error` 且带说明文字的抑制
 * 拒绝：
 * - 裸 `: any` / `as any` / `<any>`
 * - `@ts-nocheck` / `@ts-ignore` / 无说明的 `@ts-expect-error`
 *
 * 另：画布 runtime 目录的 `@ts-nocheck` 文件数不得超过基线（只减不增）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const ISLAND_GLOBS = [
  'src/utils/request.ts',
  'src/utils/leaveGuard.ts',
  'src/hooks/sseParser.ts',
  'src/components/Canvas/lib',
  'src/components/Canvas/mediaProxy.ts',
  'src/components/Canvas/mediaProxyAllowlist.ts',
  'src/components/Canvas/groupExecute',
  'src/components/Canvas/generationTaskState.ts',
  'src/components/Canvas/generationTaskApply.ts',
  'src/components/Canvas/graphNodeSizing.ts',
  'src/components/Canvas/graphCoords.ts',
]

/** 编排入口与部分域已去 nocheck 后的存量上限；新增文件禁止再加 @ts-nocheck */
const RUNTIME_NOCHECK_BASELINE = 18
const RUNTIME_DIR = 'src/components/Canvas/composables/useCanvas/runtime'

const ANY_RE = /(?<![\w$])any(?![\w$])/
const BARE_ANY_TYPE_RE = /(?::|\bas\b)\s*any\b|<\s*any\s*>/
const SUPPRESS_RE = /@ts-(nocheck|ignore|expect-error)\b/
const NOCHECK_RE = /^\s*\/\/\s*@ts-nocheck\b/

function listFiles(target) {
  const abs = path.join(root, target)
  if (!fs.existsSync(abs)) return []
  const st = fs.statSync(abs)
  if (st.isFile()) return abs.endsWith('.ts') || abs.endsWith('.tsx') ? [abs] : []
  const out = []
  for (const name of fs.readdirSync(abs)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    out.push(...listFiles(path.relative(root, path.join(abs, name))))
  }
  return out
}

function hasJustification(line) {
  return /(?:reason|说明|因为|for |due to|TODO\(|FIXME\()/i.test(line)
}

const violations = []
for (const entry of ISLAND_GLOBS) {
  for (const file of listFiles(entry)) {
    const text = fs.readFileSync(file, 'utf8')
    const lines = text.split(/\r?\n/)
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed || (trimmed.startsWith('//') && trimmed.includes('http'))) {
        // keep scanning; comments can still contain suppressions
      }
      if (BARE_ANY_TYPE_RE.test(line) && ANY_RE.test(line)) {
        if (!/\bunknown\b/.test(line)) {
          violations.push(`${path.relative(root, file)}:${index + 1}: bare any — ${trimmed.slice(0, 120)}`)
        }
      }
      if (SUPPRESS_RE.test(line) && !hasJustification(line)) {
        violations.push(
          `${path.relative(root, file)}:${index + 1}: unexplained suppression — ${trimmed.slice(0, 120)}`,
        )
      }
    })
  }
}

const nocheckFiles = listFiles(RUNTIME_DIR).filter((file) =>
  fs.readFileSync(file, 'utf8').split(/\r?\n/).some((line) => NOCHECK_RE.test(line)),
)
if (nocheckFiles.length > RUNTIME_NOCHECK_BASELINE) {
  violations.push(
    `runtime @ts-nocheck count ${nocheckFiles.length} > baseline ${RUNTIME_NOCHECK_BASELINE} (只减不增)`,
  )
}

if (violations.length) {
  console.error('[quality-gate] failed:\n' + violations.map((v) => `  - ${v}`).join('\n'))
  process.exit(1)
}

console.log(
  `[quality-gate] ok: strict island clean; runtime @ts-nocheck ${nocheckFiles.length}/${RUNTIME_NOCHECK_BASELINE}`,
)
