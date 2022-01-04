module.exports = {
      env: {
            browser: true,
            es6: true,
      },
      // extends: ['standard'],
      extends: ['some-other-config-you-use', 'prettier'],
      plugins: ['prettier'],
      globals: {
            Atomics: 'readonly',
            SharedArrayBuffer: 'readonly',
      },
      parser: 'babel-eslint',
      parserOptions: {
            ecmaVersion: 2018,
            sourceType: 'module',
      },
      rules: {
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
            'comma-dangle': [
                  'error',
                  {
                        arrays: 'never',
                        objects: 'always-multiline',
                        imports: 'never',
                        exports: 'never',
                        functions: 'never',
                  },
            ],
            'space-before-function-paren': ['error', 'never'],
            'no-undef': ['error', 'never'],
            'prettier/prettier': 'error',
            'arrow-body-style': 'off',
            'prefer-arrow-callback': 'off',
      },
}
