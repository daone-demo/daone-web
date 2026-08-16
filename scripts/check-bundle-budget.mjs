#!/usr/bin/env node
/**
 * 构建产物体积预算（gzip）。在 vite build 之后运行。
 * 默认上限按当前生产基线留约 15% 余量，防止体积回退被宽松阈值掩盖。
 * 环境变量：
 * - BUNDLE_BUDGET_DIR  默认 dist
 * - BUNDLE_BUDGET_MAX_JS_GZ  单文件 JS gzip 上限（字节），默认 220_000（约 vendor-antd 基线）
 * - BUNDLE_BUDGET_MAX_CSS_GZ 单文件 CSS gzip 上限，默认 55_000
 * - BUNDLE_BUDGET_MAX_TOTAL_JS_GZ 全部 JS gzip 总和上限，默认 1_100_000
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.resolve(root, process.env.BUNDLE_BUDGET_DIR || 'dist')
const maxJsGz = Number(process.env.BUNDLE_BUDGET_MAX_JS_GZ || 220_000)
const maxCssGz = Number(process.env.BUNDLE_BUDGET_MAX_CSS_GZ || 55_000)
const maxTotalJsGz = Number(process.env.BUNDLE_BUDGET_MAX_TOTAL_JS_GZ || 1_100_000)

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function gzipSize(buf) {
  return zlib.gzipSync(buf, { level: 9 }).length
}

if (!fs.existsSync(distDir)) {
  console.error(`[bundle-budget] missing dist: ${distDir}`)
  process.exit(1)
}

const files = walk(distDir).filter((f) => /\.(js|css)$/.test(f))
const rows = []
let totalJsGz = 0
const failures = []

for (const file of files) {
  const buf = fs.readFileSync(file)
  const gz = gzipSize(buf)
  const rel = path.relative(distDir, file)
  const isJs = file.endsWith('.js')
  if (isJs) totalJsGz += gz
  rows.push({ rel, raw: buf.length, gz, isJs })
  const limit = isJs ? maxJsGz : maxCssGz
  if (gz > limit) {
    failures.push(`${rel}: gzip ${gz} > limit ${limit}`)
  }
}

rows.sort((a, b) => b.gz - a.gz)
console.log('[bundle-budget] top assets (gzip):')
for (const row of rows.slice(0, 12)) {
  console.log(
    `  ${String(row.gz).padStart(8)}  raw=${String(row.raw).padStart(8)}  ${row.rel}`,
  )
}
console.log(`[bundle-budget] total JS gzip=${totalJsGz} (limit ${maxTotalJsGz})`)

if (totalJsGz > maxTotalJsGz) {
  failures.push(`total JS gzip ${totalJsGz} > limit ${maxTotalJsGz}`)
}

if (failures.length) {
  console.error('[bundle-budget] FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}

console.log('[bundle-budget] ok')
