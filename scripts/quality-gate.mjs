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
 * `type X = any` 必须登记 ANY_TYPE_ALIAS_WHITELIST（含 owner/expire）；注释中的同名文本不计入。
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
export const ANY_TYPE_ALIAS_WHITELIST = [
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
/** 仅匹配代码行：可选 export + type Name = any */
const TYPE_ALIAS_ANY_RE = /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=\s*any\b/
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

function isWhitelistExpired(entry, now = Date.now()) {
  if (!entry?.expire) return true
  const expireAt = Date.parse(`${entry.expire}T23:59:59Z`)
  if (Number.isNaN(expireAt)) return true
  return now > expireAt
}

/**
 * 去除行内/块注释后的可扫描代码文本；维护跨行 block comment 状态。
 * 返回 { code, nextInBlock }。
 */
export function stripCommentsForScan(line, inBlockComment) {
  let i = 0
  let code = ''
  let inBlock = inBlockComment
  let inLineComment = false
  let inSingle = false
  let inDouble = false
  let inTemplate = false

  while (i < line.length) {
    const ch = line[i]
    const next = line[i + 1]

    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false
        i += 2
        continue
      }
      i += 1
      continue
    }

    if (inLineComment) {
      break
    }

    if (inSingle) {
      code += ch
      if (ch === '\\' && i + 1 < line.length) {
        code += line[i + 1]
        i += 2
        continue
      }
      if (ch === "'") inSingle = false
      i += 1
      continue
    }
    if (inDouble) {
      code += ch
      if (ch === '\\' && i + 1 < line.length) {
        code += line[i + 1]
        i += 2
        continue
      }
      if (ch === '"') inDouble = false
      i += 1
      continue
    }
    if (inTemplate) {
      code += ch
      if (ch === '\\' && i + 1 < line.length) {
        code += line[i + 1]
        i += 2
        continue
      }
      if (ch === '`') inTemplate = false
      i += 1
      continue
    }

    if (ch === '/' && next === '*') {
      inBlock = true
      i += 2
      continue
    }
    if (ch === '/' && next === '/') {
      inLineComment = true
      break
    }
    if (ch === "'") {
      inSingle = true
      code += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inDouble = true
      code += ch
      i += 1
      continue
    }
    if (ch === '`') {
      inTemplate = true
      code += ch
      i += 1
      continue
    }

    code += ch
    i += 1
  }

  return { code, nextInBlock: inBlock }
}

export function scanSourceForViolations(rel, text, options = {}) {
  const now = options.now ?? Date.now()
  const whitelist = options.whitelist ?? ANY_TYPE_ALIAS_WHITELIST
  const violations = []
  const lines = text.split(/\r?\n/)
  let inBlockComment = false

  lines.forEach((line, index) => {
    const stripped = stripCommentsForScan(line, inBlockComment)
    inBlockComment = stripped.nextInBlock
    const code = stripped.code
    const trimmedCode = code.trim()
    if (!trimmedCode) return

    if (BARE_ANY_TYPE_RE.test(code) && ANY_RE.test(code)) {
      if (!/\bunknown\b/.test(code) && !TYPE_ALIAS_ANY_RE.test(trimmedCode)) {
        violations.push(`${rel}:${index + 1}: bare any — ${trimmedCode.slice(0, 120)}`)
      }
    }

    const aliasMatch = trimmedCode.match(TYPE_ALIAS_ANY_RE)
    if (aliasMatch) {
      const typeName = aliasMatch[1]
      const allowed = whitelist.find((entry) => entry.file === rel && entry.name === typeName)
      if (!allowed) {
        violations.push(
          `${rel}:${index + 1}: type alias any 未登记白名单 — ${trimmedCode.slice(0, 120)}`,
        )
      } else if (isWhitelistExpired(allowed, now)) {
        violations.push(
          `${rel}:${index + 1}: type alias any 白名单已过期(${allowed.expire}) owner=${allowed.owner} — ${typeName}`,
        )
      } else if (!allowed.owner || !allowed.expire) {
        violations.push(
          `${rel}:${index + 1}: type alias any 白名单缺少 owner/expire — ${typeName}`,
        )
      }
    }

    if (SUPPRESS_RE.test(trimmedCode) && !hasJustification(line) && !hasJustification(trimmedCode)) {
      violations.push(
        `${rel}:${index + 1}: unexplained suppression — ${trimmedCode.slice(0, 120)}`,
      )
    }
  })

  return violations
}

function main() {
  const violations = []
  for (const entry of [...ISLAND_GLOBS, RUNTIME_DIR]) {
    for (const file of listFiles(entry)) {
      const rel = path.relative(root, file)
      const text = fs.readFileSync(file, 'utf8')
      violations.push(...scanSourceForViolations(rel, text))
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

  const activeWhitelist = ANY_TYPE_ALIAS_WHITELIST.filter((entry) => !isWhitelistExpired(entry))
  const whitelistSummary =
    activeWhitelist.length === 0
      ? 'no active type-alias any whitelist'
      : `type-alias any whitelist(${activeWhitelist.length}): ${activeWhitelist
          .map((e) => `${e.name}@${e.owner}~${e.expire}`)
          .join(', ')}`

  console.log(
    `[quality-gate] ok: strict island scanned; runtime @ts-nocheck ${nocheckFiles.length}/${RUNTIME_NOCHECK_BASELINE}; ${whitelistSummary}`,
  )
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main()
}
