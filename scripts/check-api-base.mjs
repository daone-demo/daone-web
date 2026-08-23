/**
 * 校验生产构建产物中的 API 基址是否来自 VITE_API_BASE_URL，
 * 避免硬编码与 env 不一致导致生产请求落空。
 *
 * 用法：node scripts/check-api-base.mjs [distDir]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.resolve(root, process.argv[2] || 'dist')
const env = loadEnv('production', root, '')
const expectedBase = String(env.VITE_API_BASE_URL || '').trim()

if (!expectedBase) {
  console.error('[check-api-base] VITE_API_BASE_URL is empty for production mode')
  process.exit(1)
}

const isRelativeBase = expectedBase.startsWith('/')
const isAbsoluteBase =
  expectedBase.startsWith('http://') || expectedBase.startsWith('https://')

if (!isRelativeBase && !isAbsoluteBase) {
  console.error(
    `[check-api-base] production VITE_API_BASE_URL should be relative or absolute URL, got: ${expectedBase}`,
  )
  process.exit(1)
}

if (isAbsoluteBase && expectedBase.startsWith('http://')) {
  console.error(
    `[check-api-base] production VITE_API_BASE_URL must not use plain http (blocked by CSP connect-src). Use "/api/api/v1" with reverse proxy or https absolute URL. Got: ${expectedBase}`,
  )
  process.exit(1)
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
      continue
    }
    if (/\.(js|mjs|cjs|html|map)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

if (!fs.existsSync(distDir)) {
  console.error(`[check-api-base] dist not found: ${distDir}`)
  process.exit(1)
}

const files = walk(distDir)
const matched = files.filter((file) => fs.readFileSync(file, 'utf8').includes(expectedBase))

if (!matched.length) {
  console.error(
    `[check-api-base] production bundle does not contain API base "${expectedBase}". ` +
      'Did request.ts stop reading VITE_API_BASE_URL?',
  )
  process.exit(1)
}

// 仅当生产配置为绝对 https 基址时，禁止产物仍硬编码相对前缀
if (isAbsoluteBase) {
  const relativeOnlyHits = []
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    if (!content.includes(expectedBase) && content.includes('"/api/api/v1"')) {
      relativeOnlyHits.push(file)
    }
  }

  if (relativeOnlyHits.length) {
    console.error(
      '[check-api-base] found hard-coded relative "/api/api/v1" without production absolute base in:\n' +
        relativeOnlyHits.map((file) => `  - ${path.relative(root, file)}`).join('\n'),
    )
    process.exit(1)
  }
}

console.log(
  `[check-api-base] ok: found "${expectedBase}" in ${matched.length} file(s)`,
)
