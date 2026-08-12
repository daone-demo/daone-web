import { defineConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { loadEnv, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

const VERCEL_API_TARGETS = {
  production: {
    baseUrl: 'https://api.daoneai.com/api/v1',
    host: 'https://api.daoneai.com',
  },
  preview: {
    baseUrl: 'https://api-test.daoneai.com/api/v1',
    host: 'https://api-test.daoneai.com',
  },
} as const

const MEDIA_PROXY_HOST_RE = /(^|\.)(aliyuncs\.com|myqcloud\.com)$/i

function createMediaProxyPlugin(): Plugin {
  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || ''
    if (!rawUrl.startsWith('/media-proxy')) {
      next()
      return
    }

    try {
      const incoming = new URL(rawUrl, 'http://localhost')
      let targetUrl = incoming.searchParams.get('url') || ''

      if (!targetUrl) {
        const pathMatch = incoming.pathname.match(/^\/media-proxy\/([^/]+)\/(.+)$/)
        if (pathMatch) {
          targetUrl = `https://${pathMatch[1]}/${pathMatch[2]}${incoming.search || ''}`
        }
      }

      if (!targetUrl) {
        res.statusCode = 400
        res.end('Missing url')
        return
      }

      const parsed = new URL(targetUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        res.statusCode = 400
        res.end('Invalid protocol')
        return
      }
      if (!MEDIA_PROXY_HOST_RE.test(parsed.hostname)) {
        res.statusCode = 403
        res.end('Host not allowed')
        return
      }

      const upstream = await fetch(parsed.toString(), {
        headers: { 'User-Agent': 'daone-media-proxy/1.0' },
        redirect: 'follow',
      })
      if (!upstream.ok) {
        res.statusCode = upstream.status
        res.end(`Upstream ${upstream.status}`)
        return
      }

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
      const buffer = Buffer.from(await upstream.arrayBuffer())
      res.statusCode = 200
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=3600')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.end(buffer)
    } catch (error) {
      res.statusCode = 502
      res.end(error instanceof Error ? error.message : 'Proxy failed')
    }
  }

  return {
    name: 'daone-media-proxy',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const vercelTarget =
    process.env.VERCEL_ENV === 'production'
      ? VERCEL_API_TARGETS.production
      : process.env.VERCEL_ENV === 'preview'
        ? VERCEL_API_TARGETS.preview
        : undefined

  if (vercelTarget) {
    process.env.VITE_API_BASE_URL = vercelTarget.baseUrl
    env.VITE_API_BASE_URL = vercelTarget.baseUrl
    env.VITE_API_BASE_HOST = vercelTarget.host
  }

  return {
    server: {
      host: true,
      proxy: {
        '/api': {
          target: 'https://43.161.199.75:8088',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            const bypass = env.VITE_VERCEL_PROTECTION_BYPASS
            if (!bypass) return
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-vercel-protection-bypass', bypass)
            })
          },
        },
      },
    },
    plugins: [
      createMediaProxyPlugin(),
      vue(),
      AutoImport({
        resolvers: [AntDesignVueResolver({ importStyle: false })],
        dts: 'src/auto-imports.d.ts',
      }),
      Components({
        resolvers: [
          AntDesignVueResolver({
            importStyle: false,
          }),
        ],
        dts: 'src/components.d.ts',
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@views': path.resolve(__dirname, 'src/views'),
        '@stores': path.resolve(__dirname, 'src/stores'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@services': path.resolve(__dirname, 'src/services'),
        '@types': path.resolve(__dirname, 'src/types'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
      },
    },
  }
})
