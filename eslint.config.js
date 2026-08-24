const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'dist/**',
      'demo/main.js',
      'demo/vendor/**',
      'test/browser/fixture.bundle.js*',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'demo/index.js'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        CodeMirror: 'readonly',
      },
    },
  },
  {
    files: ['eslint.config.js', 'test/**/*.js', 'webpack.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
];
