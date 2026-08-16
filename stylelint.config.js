/** @type {import('stylelint').Config} */
/**
 * 只读质量门禁：优先拦截明显无效写法，避免对存量 Canvas SCSS
 * 强制现代 color 记法 / 选择器合并等大规模样式改写（可能影响视觉）。
 */
export default {
  extends: ['stylelint-config-recommended-vue'],
  overrides: [
    {
      files: ['**/*.{vue,html}'],
      customSyntax: 'postcss-html',
    },
    {
      files: ['**/*.{scss,sass}'],
      customSyntax: 'postcss-scss',
    },
  ],
  rules: {
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    'keyframes-name-pattern': null,
    'no-descending-specificity': null,
    'no-duplicate-selectors': null,
    'import-notation': null,
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind',
          'apply',
          'variants',
          'responsive',
          'screen',
          'function',
          'if',
          'each',
          'include',
          'mixin',
          'use',
          'forward',
          'extend',
        ],
      },
    ],
    'color-function-notation': null,
    'color-function-alias-notation': null,
    'alpha-value-notation': null,
    'declaration-block-single-line-max-declarations': null,
    'declaration-empty-line-before': null,
    'rule-empty-line-before': null,
    'comment-empty-line-before': null,
    'custom-property-empty-line-before': null,
    'value-keyword-case': null,
    'media-feature-range-notation': null,
    'property-no-deprecated': null,
    'selector-pseudo-class-no-unknown': [
      true,
      { ignorePseudoClasses: ['deep', 'global', 'slotted'] },
    ],
    'selector-pseudo-element-no-unknown': [
      true,
      { ignorePseudoElements: ['v-deep', 'v-global', 'v-slotted'] },
    ],
  },
  ignoreFiles: ['dist/**', 'node_modules/**', 'public/**', 'src/assets/**'],
}
