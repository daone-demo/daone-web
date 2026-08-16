import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const serverPath = path.join(root, 'server.mjs')

async function waitForServer(child, timeoutMs = 5000) {
  const startedAt = Date.now()
  let stdout = ''
  let stderr = ''

  child.stdout?.setEncoding('utf8')
  child.stderr?.setEncoding('utf8')
  child.stdout?.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr?.on('data', (chunk) => {
    stderr += chunk
  })

  while (Date.now() - startedAt < timeoutMs) {
    if (stdout.includes('serving') || stderr.includes('serving')) return
    if (child.exitCode != null) {
      throw new Error(`server exited early (${child.exitCode}): ${stderr || stdout}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`server start timeout: ${stderr || stdout}`)
}

test('server.mjs returns 400 for malformed URI and stays alive', async () => {
  const port = 3100 + Math.floor(Math.random() * 200)
  const child = spawn(process.execPath, [serverPath], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  try {
    await waitForServer(child)

    const response = await fetch(`http://127.0.0.1:${port}/%`)
    assert.equal(response.status, 400)
    assert.match(await response.text(), /Bad Request/i)

    // 进程应仍存活，可继续提供健康请求
    assert.equal(child.exitCode, null)
    const health = await fetch(`http://127.0.0.1:${port}/`)
    assert.ok([200, 404].includes(health.status))
    assert.equal(child.exitCode, null)
  } finally {
    child.kill('SIGTERM')
    await Promise.race([
      once(child, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ])
  }
})
