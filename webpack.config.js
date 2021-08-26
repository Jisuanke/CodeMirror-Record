const path = require('path');
const ESLintPlugin = require('eslint-webpack-plugin');

const moduleVal = {
  rules: [
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
        },
      },
    },
  ],
};

const eslintOptions = {
  extensions: [`js`, `jsx`],
  exclude: [
    `/node_modules/`,
  ],
};

const config = [
  {
    entry: './src/index.js',
    plugins: [new ESLintPlugin(eslintOptions)],
    output: {
      libraryTarget: 'umd',
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist'),
    },
    module: moduleVal,
  },
  {
    entry: './demo/index.js',
    plugins: [new ESLintPlugin(eslintOptions)],
    output: {
      filename: 'main.js',
      path: path.resolve(__dirname, 'demo'),
    },
    module: moduleVal,
  },
];

module.exports = config;
