import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      // eslint-plugin-react-hooks v5 의 flat config 키는 'recommended-latest' 다.
      // configs.flat 는 존재하지 않아 `Cannot read properties of undefined` 로 죽었다.
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { react },
    rules: {
      // JSX 안에서 쓴 변수(<Icon/>)를 '사용'으로 인식시킨다. 없으면 no-unused-vars 가 오탐을 내고,
      // 그 경고를 지우려다 실제로 쓰는 변수를 지워 런타임에 'Icon is not defined' 로 페이지가
      // 통째로 깨졌다(ChartTypeSelector, WatchlistWidget EmptyState).
      'react/jsx-uses-vars': 'error',
      // 정의되지 않은 컴포넌트를 JSX 로 렌더하면 빌드는 통과하고 런타임에야 터진다 — lint 에서 막는다.
      'react/jsx-no-undef': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      // 의도적으로 삼키는 catch 가 있다 — 빈 블록 자체는 막되 catch 는 허용한다.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Fast Refresh 힌트지 정확성 문제가 아니다. 이걸 error 로 두면 HMR 입자도만을
      // 위해 파일을 30여 개 쪼개야 한다 — 경고로 남겨 눈에는 띄되 게이트는 막지 않는다.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
