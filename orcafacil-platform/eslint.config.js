// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    extends: [eslint.configs.recommended, ...tseslint.configs.strictTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Evita uso de 'any' sem justificativa
      '@typescript-eslint/no-explicit-any': 'error',
      // Exige retorno de tipo explícito em funções exportadas
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Proíbe asserções de tipo desnecessárias
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      // Proíbe parâmetros não utilizados
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Evita promessas flutuantes não tratadas
      '@typescript-eslint/no-floating-promises': 'error',
      // Garante que strings sejam literais em templates
      '@typescript-eslint/restrict-template-expressions': 'error',
    },
  },
)

