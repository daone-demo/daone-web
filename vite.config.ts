import { defineConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { loadEnv, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import {
  ensureMediaProxyHmacSecretConfigured,
  handleMediaProxyNodeRequest,
} from './scripts/media-proxy.mjs'

function createMediaProxyPlugin(env: Record<string, string>): Plugin {
  // 开发进程内密钥：不进入前端产物；生产须显式配置 MEDIA_PROXY_HMAC_SECRET
  if (!process.env.MEDIA_PROXY_HMAC_SECRET && env.MEDIA_PROXY_HMAC_SECRET) {
    process.env.MEDIA_PROXY_HMAC_SECRET = env.MEDIA_PROXY_HMAC_SECRET
  }
  if (!process.env.MEDIA_PROXY_ALLOWED_HOSTS && env.MEDIA_PROXY_ALLOWED_HOSTS) {
    process.env.MEDIA_PROXY_ALLOWED_HOSTS = env.MEDIA_PROXY_ALLOWED_HOSTS
  }
  if (!process.env.MEDIA_PROXY_AUTH_API_BASE && env.MEDIA_PROXY_AUTH_API_BASE) {
    process.env.MEDIA_PROXY_AUTH_API_BASE = env.MEDIA_PROXY_AUTH_API_BASE
  }
  if (!process.env.VITE_API_BASE_HOST && env.VITE_API_BASE_HOST) {
    process.env.VITE_API_BASE_HOST = env.VITE_API_BASE_HOST
  }
  ensureMediaProxyHmacSecretConfigured({
    allowEphemeral: process.env.NODE_ENV !== 'production',
  })

  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || ''
    if (!rawUrl.startsWith('/media-proxy')) {
      next()
      return
    }

    // 本机常挂 fake-IP DNS 代理，会把对象存储域名解析到保留段；
    // 开发/预览服务器跳过 DNS 预检，域名白名单仍然生效
    await handleMediaProxyNodeRequest(req, res, rawUrl, {
      enforceDnsGuard: false,
      // 本地未配置鉴权 API 时，允许持有登录 Bearer 即可签发（仍无浏览器侧密钥）
      allowBearerOnly: !process.env.MEDIA_PROXY_AUTH_API_BASE,
      skipAuth: false,
    })
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

  return {
    server: {
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_HOST || 'https://43.161.199.75:8088',
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
      createMediaProxyPlugin(env),
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
        '@': path.resolve(import.meta.dirname, 'src'),
        '@assets': path.resolve(import.meta.dirname, 'src/assets'),
        '@components': path.resolve(import.meta.dirname, 'src/components'),
        '@views': path.resolve(import.meta.dirname, 'src/views'),
        '@stores': path.resolve(import.meta.dirname, 'src/stores'),
        '@utils': path.resolve(import.meta.dirname, 'src/utils'),
        '@services': path.resolve(import.meta.dirname, 'src/services'),
        '@types': path.resolve(import.meta.dirname, 'src/types'),
        '@hooks': path.resolve(import.meta.dirname, 'src/hooks'),
      },
    },
    build: {
      // 保持 Vite 默认 500 kB 告警，用拆包降低体积而非掩盖信号
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return

            if (
              id.includes('/vue/') ||
              id.includes('/vue-router/') ||
              id.includes('/pinia/') ||
              id.includes('/@vue/')
            ) {
              return 'vendor-vue'
            }
            if (id.includes('/ant-design-vue/') || id.includes('/@ant-design/')) {
              return 'vendor-antd'
            }
            if (id.includes('/@antv/x6') || id.includes('/x6-html-shape/')) {
              return 'vendor-x6'
            }
            if (id.includes('/three/')) {
              return 'vendor-three'
            }
            if (id.includes('/marked/') || id.includes('/dompurify/')) {
              return 'vendor-markdown'
            }
            if (id.includes('/jszip/')) {
              return 'vendor-zip'
            }
          },
        },
      },
    },
  }
})
