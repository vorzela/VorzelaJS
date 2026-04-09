import js from '@eslint/js'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const sharedRules = {
  'no-console': 'off',
  'no-debugger': 'warn',
  'prefer-const': 'error',
  'simple-import-sort/exports': 'error',
  'simple-import-sort/imports': 'error',
}

const unusedVariableOptions = {
  args: 'after-used',
  argsIgnorePattern: '^_',
  ignoreRestSiblings: true,
  vars: 'all',
  varsIgnorePattern: '^_',
}

const unusedImportRules = {
  'unused-imports/no-unused-imports': 'error',
}

const javascriptUnusedVariableRules = {
  'no-unused-vars': ['error', unusedVariableOptions],
}

const typescriptUnusedVariableRules = {
  '@typescript-eslint/no-unused-vars': ['error', unusedVariableOptions],
  'no-unused-vars': 'off',
}

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/routeHydration.gen.ts',
      'src/routeTree.gen.ts',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...sharedRules,
      ...unusedImportRules,
      ...javascriptUnusedVariableRules,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        sourceType: 'module',
      },
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      ...sharedRules,
      ...unusedImportRules,
      ...typescriptUnusedVariableRules,
      '@typescript-eslint/consistent-type-imports': ['warn', {
        prefer: 'type-imports',
      }],
      'no-undef': 'off',
    },
  },
]
