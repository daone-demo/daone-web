import { defineConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { loadEnv } from 'vite'

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
          target: env.VITE_API_BASE_HOST,
          changeOrigin: true,
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
