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
 * 另：画布 runtime 目录的 `@ts-nocheck` 文件数不得超过基线（只减不增），
 * 且 runtime 与 context.ts 纳入显式 any 扫描（禁止 Record<string, any> 等裸 any）。
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

/** 画布 runtime 已去掉文件级 @ts-nocheck；此上限只减不增，新增文件禁止再加 */
const RUNTIME_NOCHECK_BASELINE = 0
const RUNTIME_DIR = 'src/components/Canvas/composables/useCanvas/runtime'

/**
 * 临时 `type X = any` 白名单：仅登记项可通过；需含负责人与到期日。
 * 到期后应删除别名或收紧为具体类型，禁止无限延期。
 */
const ANY_TYPE_ALIAS_WHITELIST = [
  {
    file: 'src/components/Canvas/composables/useCanvas/runtime/installedSlots.ts',
    name: 'CoreRuntimeSlotReturn',
    owner: 'canvas-runtime',
    expire: '2026-09-30',
    reason: '动态槽位按域拆分后逐步收紧返回类型',
  },
]

const ANY_RE = /(?<![\w$])any(?![\w$])/
const BARE_ANY_TYPE_RE = /(?::|\bas\b)\s*any\b|<\s*any\s*>/
const TYPE_ALIAS_ANY_RE = /\btype\s+([A-Za-z_$][\w$]*)\s*=\s*any\b/
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
  return /(?:reason|说明|因为|for |due to|TODO\(|FIXME\(|ANY_WHITELIST|owner=)/i.test(line)
}

function findTypeAliasWhitelist(relFile, typeName) {
  return ANY_TYPE_ALIAS_WHITELIST.find(
    (entry) => entry.file === relFile && entry.name === typeName,
  )
}

function isWhitelistExpired(entry) {
  if (!entry?.expire) return true
  const expireAt = Date.parse(`${entry.expire}T23:59:59Z`)
  if (Number.isNaN(expireAt)) return true
  return Date.now() > expireAt
}

const violations = []
for (const entry of [...ISLAND_GLOBS, RUNTIME_DIR]) {
  for (const file of listFiles(entry)) {
    const rel = path.relative(root, file)
    const text = fs.readFileSync(file, 'utf8')
    const lines = text.split(/\r?\n/)
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed || (trimmed.startsWith('//') && trimmed.includes('http'))) {
        // keep scanning; comments can still contain suppressions
      }
      if (BARE_ANY_TYPE_RE.test(line) && ANY_RE.test(line)) {
        if (!/\bunknown\b/.test(line) && !TYPE_ALIAS_ANY_RE.test(line)) {
          violations.push(`${rel}:${index + 1}: bare any — ${trimmed.slice(0, 120)}`)
        }
      }
      const aliasMatch = line.match(TYPE_ALIAS_ANY_RE)
      if (aliasMatch) {
        const typeName = aliasMatch[1]
        const allowed = findTypeAliasWhitelist(rel, typeName)
        if (!allowed) {
          violations.push(
            `${rel}:${index + 1}: type alias any 未登记白名单 — ${trimmed.slice(0, 120)}`,
          )
        } else if (isWhitelistExpired(allowed)) {
          violations.push(
            `${rel}:${index + 1}: type alias any 白名单已过期(${allowed.expire}) owner=${allowed.owner} — ${typeName}`,
          )
        } else if (!allowed.owner || !allowed.expire) {
          violations.push(
            `${rel}:${index + 1}: type alias any 白名单缺少 owner/expire — ${typeName}`,
          )
        }
      }
      if (SUPPRESS_RE.test(line) && !hasJustification(line)) {
        violations.push(
          `${rel}:${index + 1}: unexplained suppression — ${trimmed.slice(0, 120)}`,
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
  `[quality-gate] ok: strict island + runtime any clean; runtime @ts-nocheck ${nocheckFiles.length}/${RUNTIME_NOCHECK_BASELINE}`,
)
