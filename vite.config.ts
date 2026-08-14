import { defineConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { loadEnv, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import { handleMediaProxyNodeRequest } from './scripts/media-proxy.mjs'

function createMediaProxyPlugin(): Plugin {
  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || ''
    if (!rawUrl.startsWith('/media-proxy')) {
      next()
      return
    }

    // 本机常挂 fake-IP DNS 代理，会把对象存储域名解析到保留段；
    // 开发/预览服务器跳过 DNS 预检，域名白名单仍然生效
    await handleMediaProxyNodeRequest(req, res, rawUrl, { enforceDnsGuard: false })
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
          // target: env.VITE_API_BASE_HOST,
          // changeOrigin: true,
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
  }
})
