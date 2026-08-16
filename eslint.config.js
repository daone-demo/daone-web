import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * 只读质量门禁：聚焦鉴权/请求/画布纯逻辑严格岛。
 * 全量 src lint 可后续扩展；此处保证核心链路无裸 any / 无说明抑制。
 */
export default defineConfig([
  globalIgnores(['**/.*', 'dist/*', '*.d.ts', 'public/*', 'src/assets/**', 'src/auto-imports.d.ts', 'src/components.d.ts']),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: [
      'src/utils/request.ts',
      'src/utils/leaveGuard.ts',
      'src/hooks/sseParser.ts',
      'src/components/Canvas/lib/**/*.{ts,tsx}',
      'src/components/Canvas/mediaProxy.ts',
      'src/components/Canvas/mediaProxyAllowlist.ts',
      'src/components/Canvas/groupExecute/**/*.{ts,tsx}',
      'src/components/Canvas/generationTaskState.ts',
      'src/components/Canvas/generationTaskApply.ts',
      'src/components/Canvas/graphNodeSizing.ts',
      'src/components/Canvas/graphCoords.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          minimumDescriptionLength: 6,
        },
      ],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
])
